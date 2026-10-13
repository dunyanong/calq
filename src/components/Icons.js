// SVG icons used across the app.
import { Text, View } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

const stroke = (color, width = 2) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

const PIN_PATH =
  'M12.4 2.1 L17.9 7.6 L15.6 8.2 L11.9 11.9 L12.4 15.3 L10.9 16.8 L7.3 13.2 L3.1 17.4 L2.6 16.9 L6.8 12.7 L3.2 9.1 L4.7 7.6 L8.1 8.1 L11.8 4.4 Z';

export function PinIcon({ size = 19, color, filled }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d={PIN_PATH} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

export function PinSolid({ size = 12, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d={PIN_PATH} fill={color} />
    </Svg>
  );
}

export function CopyIcon({ size = 19, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Rect x="6.6" y="6.6" width="10.4" height="10.4" rx="2.4" />
      <Path d="M13.4 4.2 A2.4 2.4 0 0 0 11 2.9 H5.4 A2.4 2.4 0 0 0 3 5.3 V11 A2.4 2.4 0 0 0 4.3 13.4" />
    </Svg>
  );
}

export function DuplicateIcon({ size = 19, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Rect x="3" y="3" width="9.6" height="9.6" rx="2.4" />
      <Path d="M15.2 7.4 A2.4 2.4 0 0 1 17 9.8 V14.6 A2.4 2.4 0 0 1 14.6 17 H9.8 A2.4 2.4 0 0 1 7.4 15.2" />
    </Svg>
  );
}

export function ExportIcon({ size = 19, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.6)}>
      <Path d="M10 13 L10 3" />
      <Path d="M6.4 6.2 L10 2.6 L13.6 6.2" />
      <Path d="M3.4 12.4 V15.4 A1.8 1.8 0 0 0 5.2 17.2 H14.8 A1.8 1.8 0 0 0 16.6 15.4 V12.4" />
    </Svg>
  );
}

export function TrashIcon({ size = 19, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M3.5 5.5 H16.5" />
      <Path d="M8 5.5 V3.8 A0.8 0.8 0 0 1 8.8 3 H11.2 A0.8 0.8 0 0 1 12 3.8 V5.5" />
      <Path d="M5 5.5 L5.8 15.6 A1.6 1.6 0 0 0 7.4 17 H12.6 A1.6 1.6 0 0 0 14.2 15.6 L15 5.5" />
      <Line x1="8.4" y1="8.6" x2="8.6" y2="13.8" />
      <Line x1="11.6" y1="8.6" x2="11.4" y2="13.8" />
    </Svg>
  );
}

// Export formats (CSV reuses the prototype's PDF "document" glyph).
export function CsvIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M4.6 2.8 H11.4 L15.8 7.2 V17.2 H4.6 Z" />
      <Path d="M11.2 2.9 V7.4 H15.7" />
      <Path d="M7.2 11 H13.2 M7.2 14 H13.2 M10.2 9.5 V15.5" strokeWidth={1.3} />
    </Svg>
  );
}

export function TextIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M4.6 2.8 H11.4 L15.8 7.2 V17.2 H4.6 Z" />
      <Path d="M11.2 2.9 V7.4 H15.7" />
      <Path d="M7.2 10.6 H13 M7.2 13.6 H11.4" strokeWidth={1.7} />
    </Svg>
  );
}

export function MarkdownIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Rect x="2.4" y="5.2" width="15.2" height="9.6" rx="2" />
      <Path d="M5.4 12.4 V7.8 L7.6 10.4 L9.8 7.8 V12.4" />
      <Path d="M12.6 7.9 V12.3" />
      <Path d="M11.2 10.6 L12.6 12.4 L14 10.6" />
    </Svg>
  );
}

export function LatexIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M6.4 16.6 V6.4 A3 3 0 0 1 9.4 3.4" />
      <Path d="M4.4 9.4 H10.6" />
      <Path d="M12.4 8.6 L16.6 15.4" />
      <Path d="M16.6 8.6 L12.4 15.4" />
    </Svg>
  );
}

export function PdfIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M4.6 2.8 H11.4 L15.8 7.2 V17.2 H4.6 Z" />
      <Path d="M11.2 2.9 V7.4 H15.7" />
      <Path d="M7.2 13.6 H12.4" strokeWidth={1.7} />
    </Svg>
  );
}

export function CameraIcon({ size = 17, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 1.7)}>
      <Path d="M3.5 8.4 A2 2 0 0 1 5.5 6.4 H8 L9.4 4.2 H14.6 L16 6.4 H18.5 A2 2 0 0 1 20.5 8.4 V17 A2 2 0 0 1 18.5 19 H5.5 A2 2 0 0 1 3.5 17 Z" />
      <Circle cx="12" cy="12.6" r="3.4" />
    </Svg>
  );
}

export function ChevronLeft({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 2.2)}>
      <Path d="M12 4 L6 10 L12 16" />
    </Svg>
  );
}

export function ChevronRight({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 2.2)}>
      <Path d="M8 4 L14 10 L8 16" />
    </Svg>
  );
}

export function HomeIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2)}>
      <Path d="M3.5 10.6 L12 3.6 L20.5 10.6" />
      <Path d="M5.6 9.4 L5.6 20 L18.4 20 L18.4 9.4" />
      <Path d="M9.8 20 L9.8 13.8 L14.2 13.8 L14.2 20" />
    </Svg>
  );
}

export function ClockIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2)}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.4 L12 12 L15.4 14" />
    </Svg>
  );
}

export function GearIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 1.9)}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M10.4 3.2 L13.6 3.2 L14.1 5.6 L16.2 6.8 L18.5 6 L20.1 8.8 L18.3 10.4 L18.3 13.6 L20.1 15.2 L18.5 18 L16.2 17.2 L14.1 18.4 L13.6 20.8 L10.4 20.8 L9.9 18.4 L7.8 17.2 L5.5 18 L3.9 15.2 L5.7 13.6 L5.7 10.4 L3.9 8.8 L5.5 6 L7.8 6.8 L9.9 5.6 Z" />
    </Svg>
  );
}

/** + (New session). */
export function PlusIcon({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.4)}>
      <Path d="M12 5 V19" />
      <Path d="M5 12 H19" />
    </Svg>
  );
}

// Export: Google Drive (outline of its triangle) and the sparkle marking AI study notes.
export function DriveIcon({ size = 18, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M7 3 H13 L18.5 12.5 L15.5 17.5 H4.5 L1.5 12.5 Z" />
      <Path d="M7 3 L12.5 12.5 H18.5" />
      <Path d="M4.5 17.5 L10 8" />
    </Svg>
  );
}

export function SparkleIcon({ size = 12, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M10 1.5 C10.7 6.6 13.4 9.3 18.5 10 C13.4 10.7 10.7 13.4 10 18.5 C9.3 13.4 6.6 10.7 1.5 10 C6.6 9.3 9.3 6.6 10 1.5 Z" fill={color} />
    </Svg>
  );
}

// Angle unit picker: an angle with its arc, and the ✕ that closes the picker.
export function AngleIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.5)}>
      <Path d="M16.5 16 H3.5 L13 4" />
      <Path d="M8.6 9.7 A6 6 0 0 1 10.4 16" />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.7)}>
      <Path d="M5 5 L15 15" />
      <Path d="M15 5 L5 15" />
    </Svg>
  );
}

export function SunIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.8)}>
      <Circle cx="10" cy="10" r="4.2" />
      <Line x1="10" y1="1.5" x2="10" y2="3.4" />
      <Line x1="10" y1="16.6" x2="10" y2="18.5" />
      <Line x1="1.5" y1="10" x2="3.4" y2="10" />
      <Line x1="16.6" y1="10" x2="18.5" y2="10" />
      <Line x1="4" y1="4" x2="5.3" y2="5.3" />
      <Line x1="14.7" y1="14.7" x2="16" y2="16" />
      <Line x1="16" y1="4" x2="14.7" y2="5.3" />
      <Line x1="5.3" y1="14.7" x2="4" y2="16" />
    </Svg>
  );
}

export function MoonIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" {...stroke(color, 1.8)}>
      <Path d="M13.5 2.8 A7.4 7.4 0 1 0 17.2 11 A5.8 5.8 0 0 1 13.5 2.8 Z" />
    </Svg>
  );
}

export function GoogleG({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.6z" />
      <Path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.8-3.8-12.5-9.1l-7.1 5.5C8 41 15.4 46 24 46z" />
      <Path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10z" />
      <Path fill="#EA4335" d="M24 9.9c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.8 29.9 2 24 2 15.4 2 8 7 4.4 14l7.1 5.5C13.2 13.7 18.2 9.9 24 9.9z" />
    </Svg>
  );
}

/** Prototype draws the star as a text glyph. */
export function StarIcon({ size = 19, color }) {
  return <Text style={{ fontSize: size, lineHeight: size + 3, color }}>★</Text>;
}

/** Three-bar menu button. */
export function Hamburger({ color, width = 26 }) {
  return (
    <View style={{ width, gap: 5, paddingVertical: 5, paddingHorizontal: 1 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 3, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}
