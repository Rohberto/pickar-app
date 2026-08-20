import { Image } from 'react-native';

type Props = {
  focused: boolean;
  color?: string;   // no longer used for tinting, kept so callers don't break
  size?: number;
};

export function HomeLogoIcon({ focused, size = 24 }: Props) {
  return (
    <Image
      source={
        focused
          ? require('../assets/icons/logo-filled.png')
          : require('../assets/icons/logo-transparent.png')
      }
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}