import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';

/** The prototype's 46×26 toggle (display only; the parent row handles taps). */
export default function Switch({ on, trackOn, trackOff }) {
  const [x] = useState(() => new Animated.Value(on ? 20 : 0));
  useEffect(() => {
    Animated.timing(x, { toValue: on ? 20 : 0, duration: 250, useNativeDriver: true }).start();
  }, [on, x]);
  return (
    <View style={{ width: 46, height: 26, borderRadius: 999, padding: 3, backgroundColor: on ? trackOn : trackOff }}>
      <Animated.View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#fff',
          transform: [{ translateX: x }],
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 1.5,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </View>
  );
}
