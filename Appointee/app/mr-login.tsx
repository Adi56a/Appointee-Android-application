import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:8000/api';

export default function MRLogin() {
  const router = useRouter();
  const passwordInputRef = useRef<TextInput>(null);

  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validateMobileNumber = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 10) {
      setMobileNumber(cleaned);
    }
  };

  const handleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (mobileNumber.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`${API_BASE_URL}/mr/mr-login`, {
        mr_mobile_number: mobileNumber,
        mr_password: password,
      });

      if (response.data.success && response.data.token) {
        await AsyncStorage.setItem('mr_token', response.data.token);

        setSuccessMsg('Login successful! Redirecting...');

        router.replace('/mr-dashboard');
        return;
      }

      setErrorMsg(response.data.message || 'Login failed.');
    } catch (error: any) {
      if (error.response) {
        setErrorMsg(
          error.response.data?.message ||
            'Invalid mobile number or password.'
        );
      } else if (error.request) {
        setErrorMsg('Cannot connect to server. Please try again.');
      } else {
        setErrorMsg(error.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Background */}
        <View style={styles.backgroundDecoration}>
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
        </View>

        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.iconWrapper}>
            <MaterialIcons name="business" size={58} color="#7C3AED" />
          </View>

          <Text style={styles.title}>MR Login</Text>
          <Text style={styles.subtitle}>
            Welcome back! Login to continue
          </Text>
        </View>

        {/* Card */}
        <View style={styles.formSection}>
          {!!errorMsg && (
            <View style={styles.errorBox}>
              <MaterialIcons
                name="error-outline"
                size={18}
                color="#DC2626"
              />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {!!successMsg && (
            <View style={styles.successBox}>
              <MaterialIcons
                name="check-circle-outline"
                size={18}
                color="#16A34A"
              />
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          )}

          {/* Mobile */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Mobile Number</Text>

            <View style={styles.inputContainer}>
              <MaterialIcons
                name="phone-android"
                size={22}
                color="#64748B"
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter mobile number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobileNumber}
                onChangeText={validateMobileNumber}
                editable={!loading}
                returnKeyType="next"
                onSubmitEditing={() =>
                  passwordInputRef.current?.focus()
                }
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Password</Text>

            <View style={styles.inputContainer}>
              <MaterialIcons
                name="lock"
                size={22}
                color="#64748B"
                style={styles.inputIcon}
              />

              <TextInput
                ref={passwordInputRef}
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons
                  name={
                    showPassword
                      ? 'visibility'
                      : 'visibility-off'
                  }
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              loading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {/* Register */}
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => router.push('/mr-register')}
          >
            <MaterialIcons
              name="person-add"
              size={20}
              color="#7C3AED"
            />
            <Text style={styles.signupButtonText}>
              Create New Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Medical Representative Portal
          </Text>
          <Text style={styles.footerSubtext}>
            Secure & Reliable Platform
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContainer: { flexGrow: 1, paddingBottom: 30 },

  backgroundDecoration: {
    position: 'absolute',
    width,
    height,
    overflow: 'hidden',
  },

  circle1: {
    position: 'absolute',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: '#EDE9FE',
    top: -80,
    right: -60,
  },

  circle2: {
    position: 'absolute',
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: '#DDD6FE',
    bottom: -50,
    left: -40,
  },

  circle3: {
    position: 'absolute',
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    backgroundColor: '#C4B5FD',
    top: height * 0.35,
    right: -30,
  },

  headerSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },

  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    elevation: 4,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#64748B',
  },

  formSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    elevation: 3,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },

  errorText: {
    color: '#DC2626',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },

  successText: {
    color: '#16A34A',
    marginLeft: 8,
    fontSize: 14,
  },

  inputWrapper: { marginBottom: 18 },

  inputLabel: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },

  inputIcon: { marginRight: 10 },

  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },

  loginButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },

  loginButtonDisabled: {
    backgroundColor: '#94A3B8',
  },

  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
  },

  signupButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  signupButtonText: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 15,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },

  footerText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },

  footerSubtext: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 4,
  },
});