import { StyleSheet, Text, View } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryTheme } from 'victory-native';
import { WorkoutSet } from '../lib/types';

interface Props {
  sets: WorkoutSet[];
}

export function FatigueChart({ sets }: Props) {
  const lastSet = sets[sets.length - 1];
  if (!lastSet || lastSet.reps.length < 2) return null;

  const data = lastSet.reps.map((rep, index) => ({
    x: index + 1,
    y: Number((rep.durationMs / 1000).toFixed(2)),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fatigue - Set {lastSet.setNumber} rep durations (s)</Text>
      <VictoryChart
        theme={VictoryTheme.grayscale}
        height={180}
        padding={{ left: 40, right: 20, top: 10, bottom: 30 }}
      >
        <VictoryAxis style={{ tickLabels: { fill: '#555555', fontSize: 10 } }} />
        <VictoryAxis dependentAxis style={{ tickLabels: { fill: '#555555', fontSize: 10 } }} />
        <VictoryBar
          data={data}
          style={{ data: { fill: '#e8f542', opacity: 0.85 } }}
          cornerRadius={{ top: 3 }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222222',
    marginBottom: 20,
  },
  title: { color: '#888888', fontSize: 12, letterSpacing: 1, marginBottom: 4 },
});
