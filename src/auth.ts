import { timingSafeEqual } from "crypto";

const tse_string = (a: string, b: string) => {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
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
