import React, { useContext } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import space from '@styles/space';
import StyleContext from '@styles/StyleContext';

interface Props {
  result: boolean;
}

export default function ResultIndicatorIcon({ result }: Props) {
  const { colors } = useContext(StyleContext);
  return (
    <View style={[
      styles.icon,
      space.paddingXs,
      space.paddingSideM,
    ]}>
      <MaterialCommunityIcons
        name={result ? 'thumb-up-outline' : 'thumb-down-outline'}
        size={24}
        color={result ? colors.scenarioGreen : colors.skill.combat.icon}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  icon: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
