import { identity, entitlement } from "../../server/identity";
import { failure, json } from "../../server/http";
export async function GET(request: Request) {
  try {
    const actor = await identity(request);
    return json({
      userId: actor.userId,
      ...(await entitlement(actor.userId, actor.secretKey)),
    });
  } catch (error) {
    return failure(error);
  }
}
