export type Base64Alphabet = "std" | "url";
/** RFC 4648 base64 with "=" padding. Character codes above 255 are not valid input. */
export declare function base64Encode(bytes: string, alphabet?: Base64Alphabet): string;
/** Lowercase hexadecimal. */
export declare function hexEncode(bytes: string): string;
/** Lenient percent-decoding: "%XX" with two hex digits becomes that byte; everything else is kept. */
export declare function percentDecode(text: string): string;
//# sourceMappingURL=encoding.d.ts.map