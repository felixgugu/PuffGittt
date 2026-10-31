import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

const brand: BrandVariants = {
  10: "#06120f",
  20: "#0c211b",
  30: "#123128",
  40: "#184136",
  50: "#1e5144",
  60: "#246152",
  70: "#2a7160",
  80: "#30816e",
  90: "#36917c",
  100: "#3ca18a",
  110: "#42b198",
  120: "#48c1a6",
  130: "#4ed1b4",
  140: "#54e1c2",
  150: "#5af1d0",
  160: "#60ffde",
};

export const puffLightTheme: Theme = createLightTheme(brand);
export const puffDarkTheme: Theme = createDarkTheme(brand);
