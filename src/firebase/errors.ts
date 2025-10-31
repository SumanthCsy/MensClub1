
export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete';
    requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
    public context: SecurityRuleContext;
    public requestAuth: any; // Will be populated by the listener

    constructor(context: SecurityRuleContext, message?: string) {
        const fullMessage = `Firestore Permission Denied during ${context.operation} on path ${context.path}`;
        super(message || fullMessage);
        this.name = 'FirestorePermissionError';
        this.context = context;
        this.requestAuth = null; // Placeholder for auth state

        // This is for V8 compatibility (e.g., old versions of Node)
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, new.target.prototype);
        } else {
            (this as any).__proto__ = new.target.prototype;
        }
    }
}
