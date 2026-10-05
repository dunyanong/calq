// "Calq" word mark with the mortarboard sitting on the q.
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { F } from '@/theme/fonts';

export default function Logo({ color, size = 25 }) {
  const capW = size * 0.73;
  const capH = capW * 0.66;
  const text = { fontFamily: F.bodyHeavy, fontSize: size, lineHeight: size * 1.15, color, letterSpacing: -0.6 };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={text}>Cal</Text>
      <View>
        <Svg
          width={capW}
          height={capH}
          viewBox="0 0 24 15"
          style={{ position: 'absolute', alignSelf: 'center', top: -capH + size * 0.42 }}
        >
          <Path d="M2 5.2 L12 1 L22 5.2 L12 9.4 Z" fill={color} />
          <Path d="M6.5 7 L6.5 11.5 C6.5 11.5 9 13.4 12 13.4 C15 13.4 17.5 11.5 17.5 11.5 L17.5 7" fill={color} opacity={0.55} />
          <Path d="M21.4 5.6 L21.4 10.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
        <Text style={text}>q</Text>
      </View>
    </View>
  );
}
