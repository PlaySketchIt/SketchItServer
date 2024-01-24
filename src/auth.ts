import { timingSafeEqual } from "crypto";

const tse_string = (a: string, b: string) => {
    let can_succeed = true;

    if (a.length !== b.length) {
        b = a;
        can_succeed = false;
    }

    const result = timingSafeEqual(Buffer.from(a), Buffer.from(b));
    return result && can_succeed;
};

export const validate_auth_header = (header: string | undefined) => {
    if (header === undefined) {
        return false;
    }

    const [type, token] = header.split(" ");

    if (type !== "Bearer") {
        return false;
    }

    return tse_string(token, process.env.KEY);
};

// TODO: check safety against timing attacks
// TODO: is it safe to just use one shared api key for everything?
