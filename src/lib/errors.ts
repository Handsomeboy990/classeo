// An error whose message is safe to show to the user as is. Anything else
// thrown from an action is logged and replaced by a generic message.
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
