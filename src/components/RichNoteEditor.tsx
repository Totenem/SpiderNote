import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, TextInput } from "react-native";
import { WebView } from "react-native-webview";
import { C, ui } from "@/theme/tokens";
import {
  sanitizeHtml,
  htmlToPlain,
  plainToHtml,
} from "@/features/notes/content";

export type EditorHandle = {
  command: (command: string, value?: string) => void;
  getHtml: () => Promise<string>;
  blur: () => void;
};
type Props = {
  initialHtml: string;
  onChange: (html: string) => void;
  editable?: boolean;
};

export const RichNoteEditor = forwardRef<EditorHandle, Props>(
  function RichNoteEditor({ initialHtml, onChange, editable = true }, ref) {
    const web = useRef<WebView<object>>(null);
    const latest = useRef(sanitizeHtml(initialHtml));
    const pending = useRef(new Map<string, (html: string) => void>());
    const initial = useRef(sanitizeHtml(initialHtml));
    const source = useMemo(
      () => ({ html: editorDocument(initial.current) }),
      [],
    );
    useImperativeHandle(
      ref,
      () => ({
        command: (command, value) => {
          web.current?.injectJavaScript(
            `window.editorCommand(${JSON.stringify(command)},${JSON.stringify(value ?? "")});true;`,
          );
        },
        blur: () => {
          web.current?.injectJavaScript("document.activeElement.blur();true;");
        },
        getHtml: async () => {
          if (Platform.OS === "web") return latest.current;
          const id = String(Date.now()) + Math.random();
          return new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
              pending.current.delete(id);
              reject(Error("The editor is still loading. Try saving again."));
            }, 3000);
            pending.current.set(id, (html) => {
              clearTimeout(timeout);
              resolve(html);
            });
            web.current?.injectJavaScript(
              `window.sendNote(${JSON.stringify(id)});true;`,
            );
          });
        },
      }),
      [],
    );
    if (Platform.OS === "web")
      return (
        <TextInput
          accessibilityLabel="Note text"
          multiline
          defaultValue={htmlToPlain(initial.current)}
          editable={editable}
          style={[ui.input, { flex: 1, textAlignVertical: "top" }]}
          onChangeText={(text) => {
            latest.current = plainToHtml(text);
            onChange(latest.current);
          }}
        />
      );
    return (
      <WebView<object>
        ref={web}
        source={source}
        style={{ flex: 1, backgroundColor: C.paper }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank"
        }
        onOpenWindow={() => {}}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (typeof data.html !== "string") return;
            const html = sanitizeHtml(data.html);
            latest.current = html;
            if (data.id) {
              pending.current.get(data.id)?.(html);
              pending.current.delete(data.id);
            } else onChange(html);
          } catch {
            /* Ignore messages outside the local editor protocol. */
          }
        }}
        injectedJavaScript={`document.getElementById('note').contentEditable=${JSON.stringify(String(editable))};true;`}
      />
    );
  },
);

function editorDocument(html: string) {
  const initial = JSON.stringify(html).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-spidernote'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><style>
  *{box-sizing:border-box}body{margin:0;padding:14px 24px 80px;background:${C.paper};color:${C.ink};font:17px/1.65 -apple-system,Roboto,sans-serif}#note{min-height:70vh;outline:none;overflow-wrap:anywhere}p{margin:0 0 12px}h1,h2,h3,h4{line-height:1.25;margin:18px 0 10px}h1{font-size:32px}h2{font-size:27px}h3{font-size:23px}h4{font-size:19px}blockquote{margin-left:18px}#note:empty:before{content:'Start writing…';color:${C.muted}}li{padding-left:3px}li[data-checked]{list-style:none;position:relative;padding-left:28px}li[data-checked]:before{position:absolute;left:0;content:'?';color:${C.violet}}li[data-checked="true"]:before{content:'?'}</style></head><body><div id="note" role="textbox" aria-label="Note text" aria-multiline="true" contenteditable="true"></div><script nonce="spidernote">
  const note=document.getElementById('note');note.innerHTML=${initial};let saved=null;
  document.execCommand('defaultParagraphSeparator',false,'p');document.execCommand('styleWithCSS',false,false);
  document.addEventListener('selectionchange',()=>{const s=getSelection();if(s.rangeCount&&note.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange()});
  window.sendNote=id=>window.ReactNativeWebView.postMessage(JSON.stringify({id,html:note.innerHTML}));
  note.addEventListener('input',()=>sendNote());
  window.editorCommand=(command,value)=>{note.focus();if(saved){const s=getSelection();s.removeAllRanges();s.addRange(saved)}
    if(command==='checklist'){document.execCommand('insertText',false,'☐ ')}else{document.execCommand(command,false,value||null)}sendNote();};
  note.addEventListener('paste',event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'))});
  note.addEventListener('drop',event=>event.preventDefault());
  document.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault()});
  note.addEventListener('click',event=>{const li=event.target.closest('li[data-checked]');if(li&&event.clientX<li.getBoundingClientRect().left+28){li.setAttribute('data-checked',li.getAttribute('data-checked')==='true'?'false':'true');sendNote()}});
  document.addEventListener('submit',event=>event.preventDefault());
  </script></body></html>`;
}
