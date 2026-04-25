import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const API_BASE_URL = 'http://localhost:8000/api';

type UploadFile = {
  uri: string;
  type: string;
  name: string;
};

type ModalState = {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
};

export default function MRRegistration() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  const [modal, setModal] = useState<ModalState>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const [formData, setFormData] = useState({
    mr_name: '',
    mr_email: '',
    mr_company_name: '',
    mr_city: '',
    mr_region: '',
    mr_address: '',
    mr_password: '',
    confirmPassword: '',
    experience_years: '',
  });

  const [certificate, setCertificate] = useState<UploadFile | null>(null);
  const [profilePicture, setProfilePicture] = useState<UploadFile | null>(null);
  const [certificatePreview, setCertificatePreview] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const showModal = (type: 'success' | 'error', title: string, message: string) => {
    setModal({ visible: true, type, title, message });
  };

  const hideModal = () => {
    const wasSuccess = modal.type === 'success';
    setModal((prev) => ({ ...prev, visible: false }));
    if (wasSuccess) {
      router.replace('/mr-login');
    }
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ─── OTP box handlers ──────────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);
    if (digit && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      const updated = [...otpDigits];
      updated[index - 1] = '';
      setOtpDigits(updated);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const getOtpCode = () => otpDigits.join('');

  // ─── API handlers ──────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!mobileNumber || mobileNumber.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/mr/send-otp`, { mobileNumber });
      if (response.data.success) {
        setVerificationId(response.data.verificationId);
        setOtpDigits(['', '', '', '']);
        setStep(2);
        startCountdown(60);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = getOtpCode();
    if (otpCode.length !== 4) {
      Alert.alert('Error', 'Please enter the 4-digit OTP');
      return;
    }
    if (!verificationId) {
      Alert.alert('Error', 'Please request OTP first');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/mr/verify-otp`, {
        mobileNumber,
        otpCode,
        verificationId,
      });
      if (response.data.success) {
        setStep(3);
      } else {
        Alert.alert('Error', response.data.message || 'Invalid OTP');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/mr/resend-otp`, { mobileNumber });
      if (response.data.success) {
        setVerificationId(response.data.verificationId);
        setOtpDigits(['', '', '', '']);
        startCountdown(60);
        Alert.alert('Success', 'OTP resent successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to resend OTP');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const pickProfilePicture = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Needed', 'Please grant permission to access photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const file: UploadFile = {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `profile_${Date.now()}.jpg`,
      };
      setProfilePicture(file);
      setProfilePreview(asset.uri);
    }
  };

  const pickCertificate = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const file: UploadFile = {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || `certificate_${Date.now()}`,
      };
      setCertificate(file);
      setCertificatePreview(file.type.startsWith('image/') ? file.uri : null);
    }
  };

  const validateForm = () => {
    if (!formData.mr_name.trim()) { Alert.alert('Error', 'Please enter full name'); return false; }
    if (!formData.mr_email.trim()) { Alert.alert('Error', 'Please enter email'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.mr_email)) { Alert.alert('Error', 'Invalid email'); return false; }
    if (!formData.mr_company_name.trim()) { Alert.alert('Error', 'Please enter company name'); return false; }
    if (!formData.mr_city.trim()) { Alert.alert('Error', 'Please enter city'); return false; }
    if (!formData.mr_region.trim()) { Alert.alert('Error', 'Please enter region'); return false; }
    if (!formData.mr_address.trim()) { Alert.alert('Error', 'Please enter address'); return false; }
    if (!formData.mr_password || formData.mr_password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return false; }
    if (formData.mr_password !== formData.confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return false; }
    if (!certificate) { Alert.alert('Error', 'Please upload certificate'); return false; }
    if (!profilePicture) { Alert.alert('Error', 'Please upload profile picture'); return false; }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append('mr_name', formData.mr_name.trim());
      payload.append('mr_email', formData.mr_email.trim().toLowerCase());
      payload.append('mr_mobile_number', mobileNumber);
      payload.append('mr_company_name', formData.mr_company_name.trim());
      payload.append('mr_city', formData.mr_city.trim());
      payload.append('mr_region', formData.mr_region.trim());
      payload.append('mr_address', formData.mr_address.trim());
      payload.append('mr_password', formData.mr_password);
      payload.append('experience_years', formData.experience_years || '0');

      if (certificate) {
        if (Platform.OS === 'web') {
          const certRes = await fetch(certificate.uri);
          const certBlob = await certRes.blob();
          payload.append('certificate', certBlob, certificate.name);
        } else {
          payload.append('certificate', { uri: certificate.uri, type: certificate.type, name: certificate.name } as any);
        }
      }
      if (profilePicture) {
        if (Platform.OS === 'web') {
          const imgRes = await fetch(profilePicture.uri);
          const imgBlob = await imgRes.blob();
          payload.append('profile_picture', imgBlob, profilePicture.name);
        } else {
          payload.append('profile_picture', { uri: profilePicture.uri, type: profilePicture.type, name: profilePicture.name } as any);
        }
      }

      const response = await axios.post(`${API_BASE_URL}/mr/register`, payload, {
        headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' },
        timeout: 60000,
      });

      if (response.data.success) {
        showModal('success', 'Registration Successful!', 'Your account has been created. You can now log in.');
      } else {
        showModal('error', 'Registration Failed', response.data.message || 'Something went wrong. Please try again.');
      }
    } catch (error: any) {
      let errorMessage = 'Something went wrong. Please try again.';
      if (error.response) errorMessage = error.response.data?.message || errorMessage;
      else if (error.request) errorMessage = 'Cannot connect to server. Please check your connection.';
      else errorMessage = error.message || errorMessage;
      showModal('error', 'Registration Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // ─── Shared back button ────────────────────────────────────────────────────
  const renderBackButton = (onPress: () => void) => (
    <TouchableOpacity style={styles.backButton} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.backButtonCircle}>
        <MaterialIcons name="arrow-back" size={22} color="#7C3AED" />
      </View>
    </TouchableOpacity>
  );

  // ─── Custom Modal ──────────────────────────────────────────────────────────
  const renderModal = () => {
    const isSuccess = modal.type === 'success';
    return (
      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={hideModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconCircle, isSuccess ? styles.modalIconSuccess : styles.modalIconError]}>
              <MaterialIcons name={isSuccess ? 'check-circle' : 'error'} size={48} color={isSuccess ? '#16A34A' : '#DC2626'} />
            </View>
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMessage}>{modal.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, isSuccess ? styles.modalButtonSuccess : styles.modalButtonError]}
              onPress={hideModal}
            >
              <Text style={styles.modalButtonText}>{isSuccess ? 'Go to Login' : 'Try Again'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── Step 1 ────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      {renderBackButton(() => router.back())}

      <View style={styles.iconContainer}>
        <View style={styles.iconBg}>
          <MaterialIcons name="business" size={52} color="#7C3AED" />
        </View>
      </View>

      <Text style={styles.title}>MR Registration</Text>
      <Text style={styles.subtitle}>Enter your mobile number to get started</Text>

      <View style={styles.inputContainer}>
        <MaterialIcons name="phone-android" size={20} color="#64748B" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Mobile Number"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          maxLength={10}
          value={mobileNumber}
          onChangeText={setMobileNumber}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSendOTP} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
      </TouchableOpacity>
    </View>
  );

  // ─── Step 2 ────────────────────────────────────────────────────────────────
  const renderStep2 = () => {
    const timerPercent = (countdown / 60) * 100;
    const otpComplete = getOtpCode().length === 4;

    return (
      <View style={styles.stepContainer}>
        {renderBackButton(() => setStep(1))}

        <View style={styles.iconContainer}>
          <View style={styles.iconBg}>
            <MaterialIcons name="security" size={52} color="#7C3AED" />
          </View>
        </View>

        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          A 4-digit OTP was sent to{'\n'}
          <Text style={styles.highlightText}>+91 {mobileNumber}</Text>
        </Text>

        {/* OTP Box Inputs */}
        <View style={styles.otpRow}>
          {otpDigits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { otpRefs.current[index] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              caretHidden
            />
          ))}
        </View>

        {/* 60-second countdown timer bar */}
        <View style={styles.timerContainer}>
          <View style={styles.timerBarBg}>
            <View style={[styles.timerBarFill, { width: `${timerPercent}%` as any }]} />
          </View>
          <Text style={[styles.timerText, countdown === 0 && styles.timerExpired]}>
            {countdown > 0 ? `OTP expires in ${countdown}s` : 'OTP expired — please resend'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !otpComplete && styles.buttonDisabled]}
          onPress={handleVerifyOTP}
          activeOpacity={0.85}
          disabled={!otpComplete}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResendOTP}
          style={styles.resendButton}
          disabled={countdown > 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Step 3 ────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <KeyboardAvoidingView style={styles.stepContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderBackButton(() => setStep(2))}

        <Text style={styles.title}>Complete Registration</Text>
        <Text style={styles.subtitle}>Fill in your details below</Text>

        {([
          ['person', 'Full Name', 'mr_name', 'default'],
          ['email', 'Email Address', 'mr_email', 'email-address'],
          ['business', 'Company Name', 'mr_company_name', 'default'],
          ['location-city', 'City', 'mr_city', 'default'],
          ['map', 'Region', 'mr_region', 'default'],
          ['work', 'Years of Experience', 'experience_years', 'number-pad'],
        ] as const).map((item, index) => (
          <View style={styles.inputContainer} key={index}>
            <MaterialIcons name={item[0] as any} size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={item[1]}
              placeholderTextColor="#94A3B8"
              keyboardType={item[3] as any}
              value={(formData as any)[item[2]]}
              onChangeText={(text) => setFormData({ ...formData, [item[2]]: text })}
            />
          </View>
        ))}

        <View style={styles.inputContainer}>
          <MaterialIcons name="location-on" size={20} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Address"
            placeholderTextColor="#94A3B8"
            multiline
            value={formData.mr_address}
            onChangeText={(text) => setFormData({ ...formData, mr_address: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <MaterialIcons name="lock" size={20} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#94A3B8"
            value={formData.mr_password}
            onChangeText={(text) => setFormData({ ...formData, mr_password: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Confirm Password"
            placeholderTextColor="#94A3B8"
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          />
        </View>

        <Text style={styles.sectionTitle}>Upload Documents</Text>

        <TouchableOpacity style={styles.uploadButton} onPress={pickProfilePicture}>
          <MaterialIcons name="photo-camera" size={24} color="#7C3AED" />
          <Text style={styles.uploadButtonText}>
            {profilePicture ? profilePicture.name : 'Upload Profile Picture'}
          </Text>
          {profilePicture && <MaterialIcons name="check-circle" size={20} color="#16A34A" />}
        </TouchableOpacity>

        {profilePreview && (
          <Image source={{ uri: profilePreview }} style={styles.previewImage} />
        )}

        <TouchableOpacity style={styles.uploadButton} onPress={pickCertificate}>
          <MaterialIcons name="description" size={24} color="#7C3AED" />
          <Text style={styles.uploadButtonText}>
            {certificate ? certificate.name : 'Upload Certificate'}
          </Text>
          {certificate && <MaterialIcons name="check-circle" size={20} color="#16A34A" />}
        </TouchableOpacity>

        {certificatePreview ? (
          <Image source={{ uri: certificatePreview }} style={styles.previewImage} />
        ) : certificate ? (
          <Text style={styles.fileText}>{certificate.name}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, uploading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Complete Registration</Text>}
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View style={styles.container}>
      {renderModal()}

      {/* Header with step indicator */}
      <View style={styles.header}>
        <View style={styles.stepDots}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.dot, step >= s ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
        <Text style={styles.headerTitle}>MR Onboarding</Text>
        <Text style={styles.headerStep}>Step {step} of 3</Text>
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  headerStep: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    width: 28,
    height: 4,
    borderRadius: 2,
  },
  dotActive: { backgroundColor: '#7C3AED' },
  dotInactive: { backgroundColor: '#E2E8F0' },

  // Step container
  stepContainer: { flex: 1, padding: 20, paddingTop: 12 },

  // Back button — top-left circle
  backButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Icon
  iconContainer: { alignItems: 'center', marginVertical: 16 },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  highlightText: {
    color: '#7C3AED',
    fontWeight: '600',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1E293B',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },

  // OTP boxes
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  otpBox: {
    width: 62,
    height: 68,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F0FF',
  },

  // Timer
  timerContainer: {
    marginBottom: 20,
  },
  timerBarBg: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  timerBarFill: {
    height: 4,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  timerExpired: {
    color: '#DC2626',
  },

  // Buttons
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#C4B5FD',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '500',
  },
  resendDisabled: {
    color: '#94A3B8',
  },

  // Section title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 14,
    color: '#1E293B',
  },

  // Upload
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F0FF',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  uploadButtonText: {
    marginLeft: 10,
    color: '#7C3AED',
    flex: 1,
    fontSize: 14,
  },
  previewImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginBottom: 12,
  },
  fileText: {
    color: '#475569',
    marginBottom: 12,
    fontSize: 13,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconSuccess: { backgroundColor: '#DCFCE7' },
  modalIconError: { backgroundColor: '#FEE2E2' },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSuccess: { backgroundColor: '#16A34A' },
  modalButtonError: { backgroundColor: '#DC2626' },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});