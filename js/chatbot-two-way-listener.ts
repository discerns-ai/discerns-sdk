export type ProtocolListener<T> = (message: T) => void;

export type ProtocolHandler<T, R> = (message: T) => R | Promise<R>;

type PooledProtocolListener<T extends ProtocolListener<unknown>> = {
    id: number
    listener: T
};

type ProtocolHandlerOptions = {
    preventOverwrite?: boolean
};

type PooledProtocolHandler<T extends ProtocolHandler<unknown, unknown>> = {
    id: number
    listener: T
} & Required<ProtocolHandlerOptions>;

export type TellEvent<T> = {
    payload: T
};

export type AskEvent<T, R> = {
    payload: T
    response: R
};

export type EventPayload<
    A extends Record<string, AskEvent<unknown, unknown> | TellEvent<unknown>>,
    T extends keyof A,
> = A[T]['payload'];

export type EventResponse<
    A extends Record<string, AskEvent<unknown, unknown>>,
    T extends keyof A,
> = A[T]['response'];


/**
 * A protocol that allows for two way communication between two parties
 */
export class TwoWayProtocol<Ask extends Record<string, AskEvent<unknown, unknown>>, Tell extends Record<string, TellEvent<unknown>>> {
    // the map of listeners for each event
    listeners: Map<keyof Tell, {
        queue: unknown[]
        currentListeners: PooledProtocolListener<ProtocolListener<unknown>>[]
    }> = new Map();

    // the map of handlers for each event
    handlers: Map<keyof Ask, PooledProtocolHandler<ProtocolHandler<unknown, unknown>>> = new Map();

    id = 0;


    declareTellEvent<T extends keyof Tell>(eventName: T): boolean {
        if (this.listeners.has(eventName)) return true;
        this.listeners.set(eventName, {
            queue: [],
            currentListeners: [],
        });

        return false;
    }

    /**
     * Registers a listener for a tell event
     * @param eventName - the name of the event to listen to
     * @param listener - the listener to register
     * @returns the id of the listener, which can be used to unregister it
     */
    on<T extends keyof Tell>(eventName: T, listener: ProtocolListener<EventPayload<Tell, T>>) {
        const pool = this.listeners.get(eventName);
        if (!pool) {
            throw new Error(`Event ${String(eventName)} does not exist`);
        }
        const id = this.id++;
        pool.currentListeners.push({
            id,
            listener,
        });
        if (pool.queue.length > 0) {
            pool.queue.forEach(value => listener(value));
            pool.queue = [];
        }
        this.listeners.set(eventName, pool);

        return id;
    }

    /**
     * Unregisters a listener for a tell event
     * @param eventName - the name of the event to unregister from
     * @param id - the id of the listener to unregister
     * @returns whether the listener was unregistered
     */
    off<T extends keyof Tell>(eventName: T, id: number) {
        const pool = this.listeners.get(eventName);
        if (!pool) {
            return false;
        }
        const length = pool.currentListeners.length;
        const newPool = pool.currentListeners.filter(l => l.id !== id);
        this.listeners.set(eventName, {
            ...pool,
            currentListeners: newPool,
        });

        return length !== newPool.length;
    }

    /**
     * Registers a handler for an ask event
     * @param eventName - the name of the event to register for
     * @param listener - the handler to register
     * @param options - options for the handler
     * @returns the id of the handler, which can be used to unregister it
     */
    registerUniqueAskHandler<T extends keyof Ask>(eventName: T, listener: ProtocolHandler<EventPayload<Ask, T>, EventResponse<Ask, T>>, options?: ProtocolHandlerOptions) {
        const existing = this.handlers.get(eventName);
        if (existing && existing.preventOverwrite) {
            throw new Error(`Handler for ${String(eventName)} already exists and it set itself as not overwritable`);
        }
        const id = this.id++;
        this.handlers.set(eventName, {
            id,
            listener,
            preventOverwrite: options?.preventOverwrite ?? false,
        });

        return { id, existing: Boolean(existing) };
    }

    /**
     * Unregisters a handler for an ask event
     * @param eventName - the name of the event to unregister from
     * @param id - the id of the handler to unregister
     */
    unregisterAskHandler<T extends keyof Ask>(eventName: T, id: number) {
        const existing = this.handlers.get(eventName);
        if (existing?.id !== id) {
            return false;
        }
        this.handlers.delete(eventName);

        return true;
    }

    /**
     * Sends an ask event and waits for a response
     * @param eventName - the name of the event to send
     * @param payload - the payload of the event which will be passed to the handler
     * @throws if there is no handler for the event
     * @returns the response of the handler
     */
    ask<T extends keyof Ask>(eventName: T, payload: EventPayload<Ask, T>): Promise<EventResponse<Ask, T>> {
        const handler = this.handlers.get(eventName);
        if (!handler) {
            throw new Error(`No handler for ${String(eventName)}`);
        }

        return new Promise((resolve, reject) => {
            const response = handler.listener(payload);
            if (response instanceof Promise) {
                response.then(resolve).catch(reject);
            } else {
                resolve(response);
            }
        });
    }

    /**
     * Sends a tell event
     * @param eventName - the name of the event to send
     * @param payload - the payload of the event which will be passed to the listeners
     * @throws if there are no listeners for the event
     */
    tell<T extends keyof Tell>(eventName: T, payload: EventPayload<Tell, T>) {
        const listeners = this.listeners.get(eventName);
        if (!listeners) {
            throw new Error(`Event does not exist ${String(eventName)}`);
        }
        if (listeners.currentListeners.length === 0) {
            listeners.queue.push(payload);
        } else {
            listeners.currentListeners.forEach(({ listener }) => listener(payload));
        }
    }
}




