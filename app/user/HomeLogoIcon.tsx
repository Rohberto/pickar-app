import Svg, { Path } from 'react-native-svg';

type Props = {
  focused: boolean;
  color: string;   // tabBarActiveTintColor / tabBarInactiveTintColor, passed in by Tabs.Screen
  size?: number;
};

/**
 * Stylized bird-in-flight + droplet mark (Pickar logo), built as a single
 * SVG path so it can be a thin stroke when inactive and a solid "lit up"
 * fill when active — no separate raster assets needed.
 *
 * The path below is a hand-traced approximation of the uploaded logo
 * (swept wing bird with a teardrop/parcel hanging beneath the head).
 * Nudge the `d` coordinates if you want the proportions tighter to the
 * original mark — it's one continuous path so it's easy to tweak in an
 * SVG editor (e.g. paste into https://yqnn.github.io/svg-path-editor/).
 */
export function HomeLogoIcon({ focused, color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 70" fill="none">
      {/* Bird body + wings */}
      <Path
        d="
          M 30 20
          C 22 8, 14 2, 4 0
          C 14 6, 20 16, 22 26
          C 14 24, 6 22, 0 24
          C 10 28, 18 32, 24 38
          C 30 48, 40 58, 52 64
          C 62 68, 74 66, 84 58
          C 76 58, 68 56, 60 50
          C 70 48, 82 42, 96 26
          C 82 32, 68 36, 56 36
          C 48 30, 40 24, 30 20
          Z
        "
        stroke={color}
        strokeWidth={focused ? 0 : 3}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={focused ? color : 'none'}
      />
      {/* Droplet / parcel hanging beneath */}
      <Path
        d="
          M 14 26
          C 8 34, 4 42, 6 48
          C 7.5 53, 13 55, 17 51
          C 21 47, 20 40, 16 32
          C 15 30, 14.5 28, 14 26
          Z
        "
        stroke={color}
        strokeWidth={focused ? 0 : 3}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={focused ? color : 'none'}
      />
    </Svg>
  );
}