// src/screens/LandingScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors } from '../theme/colors';

interface LandingScreenProps {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onJoinWithCode: () => void;
}

export default function LandingScreen({ onSignIn, onCreateAccount, onJoinWithCode }: LandingScreenProps) {
  return (
    <View style={styles.container}>
      {/* Your Logo / Illustration */}
      <View style={styles.logoContainer}>
        <Text style={styles.appName}>TeamConnect</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onSignIn}>
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onCreateAccount}>
          <Text style={styles.secondaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <View style={styles.codeSection}>
          <Text style={styles.codeText}>Have a group code? </Text>
          <TouchableOpacity onPress={onJoinWithCode}>
            <Text style={styles.joinLink}>Join Team</Text>
          </TouchableOpacity>
          
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 60 },
  appName: { color: colors.primary, fontSize: 36, fontWeight: 'bold' },
  buttonContainer: { width: '100%' },
  primaryBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  primaryBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  secondaryBtn: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 30 },
  secondaryBtnText: { color: colors.textMain, fontSize: 18, fontWeight: 'bold' },
  codeSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  codeText: { color: colors.textSubtle, fontSize: 15 },
  joinLink: { color: colors.teal, fontSize: 15, fontWeight: 'bold', textDecorationLine: 'underline' },
});