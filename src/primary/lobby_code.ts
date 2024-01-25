import { nanoid, urlAlphabet } from "nanoid";

const CODE_LENGTH = 10;

const combinations = Math.pow(urlAlphabet.length, CODE_LENGTH);

const codes: { [code: string]: number } = {}; // keys are codes, values are owner worker ids

export const allocate = (worker_id: number) => {
    if (codes.length >= combinations) {
        throw new Error("No more codes available");
    }

    const id = nanoid(CODE_LENGTH);

    if (id in codes) {
        return allocate(worker_id);
    }

    codes[id] = worker_id;
    return id;
};

export const deallocate = (code: string) => {
    delete codes[code];
};

export const get_owner = (code: string) => {
    return codes[code];
};

export const exists = (code: string) => {
    return code in codes;
};

export const deallocate_worker = (worker_id: number) => {
    for (const code in codes) {
        if (codes[code] === worker_id) {
            deallocate(code);
        }
    }
};
