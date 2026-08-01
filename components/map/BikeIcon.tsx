// components/map/BikeIcon.tsx
import { Colors } from '@/constants/colors';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface BikeIconProps {
  size?: number;
  color?: string;
}

/**
 * Top-down delivery-bike marker. Points "up" at rest — the wrapping
 * Animated.View in AnimatedDriverMarker rotates this to match the
 * driver's actual direction of travel.
 */
export default function BikeIcon({ size = 26, color = Colors.primary }: BikeIconProps) {
  return (
    <View style={styles.shadowWrap}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        {/* rear wheel */}
        <Rect x="12.5" y="23" width="7" height="6.5" rx="2.4" fill="#1F2937" />
        {/* body / tank, teardrop pointing forward (up) */}
        <Path
          d="M16 5.5
             C19.8 5.5 21.8 9.4 21 14.2
             C20.3 18.4 18.7 21.6 16 25.5
             C13.3 21.6 11.7 18.4 11 14.2
             C10.2 9.4 12.2 5.5 16 5.5 Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.2}
        />
        {/* front wheel */}
        <Rect x="12.5" y="1.5" width="7" height="6.5" rx="2.4" fill="#1F2937" />
        {/* headlight accent */}
        <Circle cx="16" cy="9.4" r="1.5" fill="#ffffff" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
});