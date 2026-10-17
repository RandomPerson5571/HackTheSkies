import { Image, type ImageProps } from "react-native";

export type LazyImageProps = ImageProps & { eager?: boolean };

// Native lists control mounting; resize large remote images before decoding on Android.
export function LazyImage({ eager: _eager, ...props }: LazyImageProps) {
  return <Image resizeMethod="resize" {...props} />;
}
