import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

const GoalMascot = () => {
  return (
    <View style={styles.mascotContainer}>
      <Image 
          source={require('../../assets/co.png')} 
          style={styles.gifImage}
          resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mascotContainer: { 
      alignItems: 'center', 
      justifyContent: 'center', 
      position: 'relative',
      overflow: 'visible',
      paddingTop: 0,
      marginTop: 0,
  },
  gifImage: {
      width: 110,
      height: 110,
  }
});

export default GoalMascot;