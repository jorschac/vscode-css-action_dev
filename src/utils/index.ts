import tinycolor from "tinycolor2";

export function normalizeColorValue(str: string) {
	if (str) {
	  const color = tinycolor(str);
	  return color.isValid() ? tinycolor(str).toHex8String() : null;
	} else {
	  return null;
	}
  }