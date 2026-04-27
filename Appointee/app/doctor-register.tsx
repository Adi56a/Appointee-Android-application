import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:8000/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'error' | 'success' | 'info';
interface ToastMessage { id: number; type: ToastType; title: string; message: string; }

// ─── Toast Item ───────────────────────────────────────────────────────────────
const ToastItem = memo(({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity,    { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20 }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 280, useNativeDriver: true }),
      ]).start(() => onDismiss(toast.id));
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const cfg = {
    error:   { bg: '#FEF2F2', border: '#FCA5A5', icon: '#DC2626', name: 'error-outline'        as const },
    success: { bg: '#F0FDF4', border: '#86EFAC', icon: '#16A34A', name: 'check-circle-outline' as const },
    info:    { bg: '#EFF6FF', border: '#93C5FD', icon: '#2563EB', name: 'info-outline'          as const },
  }[toast.type];

  return (
    <Animated.View style={[tS.wrap, { backgroundColor: cfg.bg, borderColor: cfg.border, opacity, transform: [{ translateY }] }]}>
      <View style={[tS.iconBox, { backgroundColor: cfg.border + '66' }]}>
        <MaterialIcons name={cfg.name} size={19} color={cfg.icon} />
      </View>
      <View style={tS.texts}>
        <Text style={[tS.title, { color: cfg.icon }]}>{toast.title}</Text>
        {!!toast.message && <Text style={tS.msg}>{toast.message}</Text>}
      </View>
      <TouchableOpacity onPress={() => onDismiss(toast.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="close" size={15} color="#94A3B8" />
      </TouchableOpacity>
    </Animated.View>
  );
});

const tS = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  texts:   { flex: 1 },
  title:   { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  msg:     { fontSize: 12, color: '#475569', lineHeight: 16 },
});

// ─── 4-Digit OTP Input ────────────────────────────────────────────────────────
const OTPInput = memo(({ value, onChange, hasError = false }: {
  value: string; onChange: (v: string) => void; hasError?: boolean;
}) => {
  const inputRef = useRef<TextInput>(null);
  const OTP_LEN  = 4;
  const digits   = Array.from({ length: OTP_LEN }, (_, i) => value[i] || '');
  const BOX_W    = (width - 80) / OTP_LEN;

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={oS.wrapper}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, OTP_LEN))}
        keyboardType="number-pad"
        maxLength={OTP_LEN}
        style={oS.hidden}
        caretHidden
        autoFocus
      />
      {digits.map((d, i) => {
        const isActive = value.length === i || (value.length === OTP_LEN && i === OTP_LEN - 1);
        const isFilled = !!d;
        return (
          <View
            key={i}
            style={[
              oS.box,
              { width: BOX_W - 10, height: BOX_W - 4 },
              isFilled && oS.boxFilled,
              isActive && oS.boxActive,
              hasError && oS.boxError,
            ]}>
            {isFilled
              ? <Text style={oS.digit}>{d}</Text>
              : isActive ? <View style={oS.cursor} /> : null}
          </View>
        );
      })}
    </TouchableOpacity>
  );
});

const oS = StyleSheet.create({
  wrapper: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 10 },
  hidden:  { position: 'absolute', width: 1, height: 1, opacity: 0 },
  box:     { borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  boxFilled: { backgroundColor: '#EEF4FF', borderColor: '#93C5FD' },
  boxActive: { borderColor: '#2563EB', backgroundColor: '#FFFFFF', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  boxError:  { borderColor: '#F87171', backgroundColor: '#FEF2F2' },
  digit:   { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  cursor:  { width: 2, height: 26, backgroundColor: '#2563EB', borderRadius: 1 },
});

// ─── Field Error ──────────────────────────────────────────────────────────────
const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, paddingLeft: 4, gap: 4 }}>
      <MaterialIcons name="error-outline" size={12} color="#DC2626" />
      <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '600' }}>{message}</Text>
    </View>
  ) : null;

// ─── Slim Step Bar ────────────────────────────────────────────────────────────
const StepBar = memo(({ step }: { step: number }) => {
  const labels = ['Contact', 'Verify', 'Profile'];
  return (
    <View style={sbS.wrap}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done   = step > n;
        const active = step === n;
        return (
          <View key={label} style={sbS.item}>
            <View style={[sbS.line, done && sbS.lineDone, active && sbS.lineActive]} />
            <Text style={[sbS.label, active && sbS.labelActive, done && sbS.labelDone]}>
              {done ? '✓ ' : ''}{label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

const sbS = StyleSheet.create({
  wrap:        { flexDirection: 'row', gap: 8, marginTop: 10 },
  item:        { flex: 1, alignItems: 'center' },
  line:        { width: '100%', height: 3, borderRadius: 99, backgroundColor: '#E2E8F0', marginBottom: 5 },
  lineActive:  { backgroundColor: '#2563EB' },
  lineDone:    { backgroundColor: '#16A34A' },
  label:       { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 },
  labelActive: { color: '#2563EB' },
  labelDone:   { color: '#16A34A' },
});

// ─── FormField — HOISTED TO MODULE LEVEL so it is NEVER recreated on re-render ──
// This is the critical fix: defining Field inside the parent component causes React
// to treat it as a new component type on every render → unmount → TextInput loses focus.
interface FieldProps {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  maxLength?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  errorKey?: string;
  // passed from parent so Field can read/clear errors without being defined inside parent
  fieldErrors: Record<string, string>;
  onClearError?: (key: string) => void;
  editable?: boolean;
}

const FormField = memo(({
  label, icon, placeholder, value, onChangeText,
  keyboardType = 'default', maxLength, secureTextEntry = false,
  autoCapitalize = 'sentences', multiline = false, numberOfLines = 1,
  errorKey, fieldErrors, onClearError, editable = true,
}: FieldProps) => {
  const hasErr = errorKey ? !!fieldErrors[errorKey] : false;
  return (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.inputShell, multiline && s.inputShellMulti, hasErr && s.inputShellErr]}>
        <View style={[s.iconBox, hasErr && s.iconBoxErr]}>
          <MaterialIcons name={icon} size={17} color={hasErr ? '#DC2626' : '#2563EB'} />
        </View>
        <TextInput
          style={[s.input, multiline && s.textArea]}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={t => {
            onChangeText(t);
            if (errorKey && fieldErrors[errorKey] && onClearError) onClearError(errorKey);
          }}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          // Keep focus when user taps — do NOT dismiss on submit for non-last fields
          blurOnSubmit={false}
        />
      </View>
      {errorKey && <FieldError message={fieldErrors[errorKey]} />}
    </View>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DoctorRegistration() {
  const router = useRouter();
  const [step, setStep]                     = useState(1);
  const [mobileNumber, setMobileNumber]     = useState('');
  const [otpCode, setOtpCode]               = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading]               = useState(false);
  const [countdown, setCountdown]           = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [toasts, setToasts]                 = useState<ToastMessage[]>([]);
  const toastId  = useRef(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [mobileError, setMobileError] = useState('');
  const [otpError,    setOtpError]    = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    dr_name: '', dr_degree: '', dr_email: '',
    dr_city: '', dr_address: '', dr_password: '', confirmPassword: '',
  });

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────────
  const showToast = (type: ToastType, title: string, message = '') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, type, title, message }]);
  };
  const dismissToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  const clearFieldError = (key: string) =>
    setFieldErrors(p => { const n = { ...p }; delete n[key]; return n; });

  const animStep = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  };

  // ── API Handlers ───────────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    setMobileError('');
    if (!mobileNumber || mobileNumber.length !== 10) {
      setMobileError('Enter a valid 10-digit mobile number');
      showToast('error', 'Invalid Number', 'Mobile number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/doctors/send-otp`, { mobileNumber });
      if (res.data.success) {
        setVerificationId(res.data.verificationId);
        animStep(() => setStep(2));
        startCountdown(60);
        showToast('success', 'OTP Sent!', `4-digit code sent to +91 ${mobileNumber}`);
      } else {
        showToast('error', 'Failed to Send OTP', res.data.message || 'Please try again.');
      }
    } catch (e: any) {
      showToast('error', e.response ? 'Error' : 'Connection Error',
        e.response?.data?.message || 'Cannot reach server. Check your connection.');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    setOtpError('');
    if (!otpCode || otpCode.length !== 4) {
      setOtpError('Please enter the complete 4-digit OTP');
      showToast('error', 'Incomplete OTP', 'Enter all 4 digits.');
      return;
    }
    if (!verificationId) { showToast('error', 'Session Expired', 'Request a new OTP.'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/doctors/verify-otp`, { mobileNumber, otpCode, verificationId });
      if (res.data.success) {
        animStep(() => setStep(3));
        showToast('success', 'Verified!', 'Mobile number confirmed.');
      } else {
        setOtpError(res.data.message || 'The OTP entered is incorrect.');
        showToast('error', 'Verification Failed', res.data.message || 'Incorrect or expired OTP.');
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Invalid OTP.';
      setOtpError(msg);
      showToast('error', 'Invalid OTP', msg);
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) { showToast('info', 'Please Wait', `Resend available in ${countdown}s.`); return; }
    setLoading(true); setOtpCode(''); setOtpError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/doctors/resend-otp`, { mobileNumber });
      if (res.data.success) {
        setVerificationId(res.data.verificationId);
        startCountdown(60);
        showToast('success', 'OTP Resent', 'New 4-digit code sent to your number.');
      } else { showToast('error', 'Resend Failed', res.data.message || 'Could not resend OTP.'); }
    } catch (e: any) {
      showToast('error', e.response ? 'Error' : 'Connection Error', e.response?.data?.message || 'Failed to resend.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const errs: Record<string, string> = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.dr_name.trim())    errs.dr_name         = 'Full name is required';
    if (!formData.dr_degree.trim())  errs.dr_degree       = 'Medical degree is required';
    if (!formData.dr_email.trim())   errs.dr_email        = 'Email address is required';
    else if (!emailRe.test(formData.dr_email)) errs.dr_email = 'Enter a valid email address';
    if (!formData.dr_city.trim())    errs.dr_city         = 'City is required';
    if (!formData.dr_address.trim()) errs.dr_address      = 'Address is required';
    if (!formData.dr_password)       errs.dr_password     = 'Password is required';
    else if (formData.dr_password.length < 6) errs.dr_password = 'Minimum 6 characters';
    if (!formData.confirmPassword)   errs.confirmPassword = 'Please confirm your password';
    else if (formData.dr_password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { showToast('error', 'Incomplete Form', Object.values(errs)[0]); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/doctors/register`, {
        dr_name: formData.dr_name, dr_degree: formData.dr_degree, dr_email: formData.dr_email,
        dr_mobile_number: mobileNumber, dr_city: formData.dr_city,
        dr_address: formData.dr_address, dr_password: formData.dr_password,
      });
      if (res.data.success) {
        showToast('success', 'Registration Successful!', 'Your account has been created.');
        setTimeout(() => router.replace('/doctor-login'), 1500);
      } else {
        const msg = res.data.message || 'Registration failed. Please try again.';
        showToast('error', 'Registration Failed', msg);
        if (res.data.field) setFieldErrors(p => ({ ...p, [res.data.field]: msg }));
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Something went wrong.';
      showToast('error', 'Registration Failed', msg);
      if (msg.toLowerCase().includes('email')) setFieldErrors(p => ({ ...p, dr_email: msg }));
    } finally { setLoading(false); }
  };

  // ── Shared props shorthand for FormField ──────────────────────────────────────
  // Pass fieldErrors + clearFieldError + editable as a bundle so every FormField
  // gets them without repetition.
  const fp = { fieldErrors, onClearError: clearFieldError, editable: !loading };

  // ── Step 1 ─────────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={s.card}>
      <View style={s.heroWrap}>
        <View style={s.heroIcon}><MaterialIcons name="smartphone" size={26} color="#2563EB" /></View>
        <View style={s.heroPulse} />
      </View>
      <Text style={s.cardTitle}>Get Started</Text>
      <Text style={s.cardSub}>Enter your mobile number to receive a 4-digit verification code</Text>

      <View style={s.infoStrip}>
        <MaterialIcons name="lock" size={14} color="#2563EB" />
        <Text style={s.infoText}>End-to-end encrypted · Secure verification</Text>
      </View>

      <FormField
        {...fp}
        label="Mobile Number" icon="phone"
        placeholder="Enter 10-digit mobile number"
        value={mobileNumber}
        onChangeText={t => { setMobileNumber(t); if (mobileError) setMobileError(''); }}
        keyboardType="phone-pad" maxLength={10} autoCapitalize="none"
      />
      <FieldError message={mobileError} />

      <TouchableOpacity
        style={[s.btn, loading && s.btnOff]}
        onPress={handleSendOTP} disabled={loading} activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color="#FFF" size="small" />
          : <><Text style={s.btnTxt}>Send OTP</Text><View style={s.btnChip}><MaterialIcons name="arrow-forward" size={15} color="#2563EB" /></View></>}
      </TouchableOpacity>
    </View>
  );

  // ── Step 2 ─────────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <View>
      <TouchableOpacity style={s.backBtn} onPress={() => animStep(() => setStep(1))}>
        <MaterialIcons name="arrow-back-ios-new" size={13} color="#2563EB" />
        <Text style={s.backTxt}>Back</Text>
      </TouchableOpacity>
      <View style={s.card}>
        <View style={s.heroWrap}>
          <View style={s.heroIcon}><MaterialIcons name="sms" size={26} color="#2563EB" /></View>
          <View style={s.heroPulse} />
        </View>
        <Text style={s.cardTitle}>Verify Number</Text>
        <Text style={s.cardSub}>
          Enter the 4-digit code sent to{'\n'}
          <Text style={s.highlight}>+91 {mobileNumber}</Text>
        </Text>

        <Text style={[s.fieldLabel, { textAlign: 'center', marginBottom: 4 }]}>ONE-TIME PASSWORD</Text>
        <OTPInput value={otpCode} onChange={setOtpCode} hasError={!!otpError} />
        <FieldError message={otpError} />

        <TouchableOpacity
          style={[s.btn, loading && s.btnOff, { marginTop: 18 }]}
          onPress={handleVerifyOTP} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <><Text style={s.btnTxt}>Verify & Continue</Text><View style={s.btnChip}><MaterialIcons name="check" size={15} color="#2563EB" /></View></>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.ghost, (countdown > 0 || loading) && s.ghostOff]}
          onPress={handleResendOTP} disabled={countdown > 0 || loading} activeOpacity={0.7}>
          <MaterialIcons name="refresh" size={15} color={countdown > 0 || loading ? '#94A3B8' : '#2563EB'} />
          <Text style={[s.ghostTxt, (countdown > 0 || loading) && s.ghostTxtOff]}>
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 3 ─────────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <View>
      <TouchableOpacity style={s.backBtn} onPress={() => animStep(() => setStep(2))}>
        <MaterialIcons name="arrow-back-ios-new" size={13} color="#2563EB" />
        <Text style={s.backTxt}>Back</Text>
      </TouchableOpacity>
      <View style={s.card}>
        <View style={s.heroWrap}>
          <View style={s.heroIcon}><MaterialIcons name="badge" size={26} color="#2563EB" /></View>
          <View style={s.heroPulse} />
        </View>
        <Text style={s.cardTitle}>Complete Profile</Text>
        <Text style={s.cardSub}>Fill in your professional details to finish registration</Text>

        <View style={s.sectionRow}><View style={s.sectionBar} /><Text style={s.sectionTxt}>Professional Info</Text></View>

        <FormField {...fp} label="Full Name"      icon="person"        placeholder="Dr. Full Name"       errorKey="dr_name"    value={formData.dr_name}    onChangeText={t => setFormData(f => ({ ...f, dr_name: t }))} />
        <FormField {...fp} label="Medical Degree" icon="school"        placeholder="e.g. MBBS, MD, MS"  errorKey="dr_degree"  value={formData.dr_degree}  onChangeText={t => setFormData(f => ({ ...f, dr_degree: t }))} />
        <FormField {...fp} label="Email Address"  icon="email"         placeholder="doctor@example.com" errorKey="dr_email"   value={formData.dr_email}   onChangeText={t => setFormData(f => ({ ...f, dr_email: t }))}   keyboardType="email-address" autoCapitalize="none" />
        <FormField {...fp} label="City"           icon="location-city" placeholder="Enter your city"    errorKey="dr_city"    value={formData.dr_city}    onChangeText={t => setFormData(f => ({ ...f, dr_city: t }))} />
        <FormField {...fp} label="Clinic / Hospital Address" icon="location-on" placeholder="Full address" errorKey="dr_address" value={formData.dr_address} onChangeText={t => setFormData(f => ({ ...f, dr_address: t }))} multiline numberOfLines={3} />

        <View style={s.sectionRow}><View style={s.sectionBar} /><Text style={s.sectionTxt}>Set Password</Text></View>

        <FormField {...fp} label="Password"         icon="lock"         placeholder="Create a strong password" errorKey="dr_password"    value={formData.dr_password}    onChangeText={t => setFormData(f => ({ ...f, dr_password: t }))}    secureTextEntry autoCapitalize="none" />
        <FormField {...fp} label="Confirm Password" icon="lock-outline" placeholder="Re-enter your password"   errorKey="confirmPassword" value={formData.confirmPassword} onChangeText={t => setFormData(f => ({ ...f, confirmPassword: t }))} secureTextEntry autoCapitalize="none" />

        <TouchableOpacity
          style={[s.btn, s.btnGreen, loading && s.btnOff]}
          onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <><Text style={s.btnTxt}>Complete Registration</Text><View style={s.btnChip}><MaterialIcons name="check" size={15} color="#16A34A" /></View></>}
        </TouchableOpacity>

        <View style={s.loginRow}>
          <Text style={s.loginTxt}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/doctor-login')} activeOpacity={0.7}>
            <Text style={s.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ── Root render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4FF" />

      {/* Floating toast layer */}
      <View style={s.toastLayer} pointerEvents="box-none">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />)}
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}>

          {/* Compact header with slim step bar */}
          <View style={s.header}>
            <View style={s.badge}>
              <MaterialIcons name="local-hospital" size={12} color="#1D4ED8" />
              <Text style={s.badgeTxt}>Doctor Registration</Text>
            </View>
            <Text style={s.headerTitle}>Create Account</Text>
            <Text style={s.headerSub}>Join our verified medical network</Text>
            <StepBar step={step} />
          </View>

          {/* Animated step content */}
          <Animated.View style={[s.stepWrap, { opacity: fadeAnim }]}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#F0F4FF' },
  flex:  { flex: 1 },

  toastLayer: { position: 'absolute', top: 10, left: 16, right: 16, zIndex: 999 },

  scroll: { paddingBottom: 48, flexGrow: 1 },

  // Header
  header:      { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  badge:       { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#DBEAFE', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10, gap: 5 },
  badgeTxt:    { fontSize: 11, color: '#1D4ED8', fontWeight: '700', letterSpacing: 0.3 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4, marginBottom: 3 },
  headerSub:   { fontSize: 13, color: '#64748B', marginBottom: 14 },

  stepWrap: { paddingHorizontal: 20 },

  // Back button
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2, marginBottom: 8, gap: 4 },
  backTxt: { fontSize: 14, fontWeight: '700', color: '#2563EB' },

  // Card
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 4 },

  // Hero icon
  heroWrap:  { alignSelf: 'center', marginBottom: 16, position: 'relative' },
  heroIcon:  { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EEF4FF', borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  heroPulse: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 24, borderWidth: 1, borderColor: '#BFDBFE', opacity: 0.5 },

  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 5, letterSpacing: -0.3 },
  cardSub:   { fontSize: 13, lineHeight: 20, color: '#64748B', textAlign: 'center', marginBottom: 18 },
  highlight: { color: '#2563EB', fontWeight: '700' },

  // Info strip
  infoStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, gap: 7 },
  infoText:  { fontSize: 12, color: '#0369A1', fontWeight: '600' },

  // Section dividers
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 12, gap: 8 },
  sectionBar: { width: 4, height: 16, backgroundColor: '#2563EB', borderRadius: 2 },
  sectionTxt: { fontSize: 14, fontWeight: '800', color: '#0F172A' },

  // Form fields
  fieldGroup:      { marginBottom: 12 },
  fieldLabel:      { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6, paddingLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputShell:      { minHeight: 54, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  inputShellMulti: { alignItems: 'flex-start', paddingTop: 10 },
  inputShellErr:   { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  iconBox:    { width: 32, height: 32, borderRadius: 9, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  iconBoxErr: { backgroundColor: '#FEE2E2' },
  input:      { flex: 1, fontSize: 15, color: '#0F172A', paddingVertical: 14 },
  textArea:   { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },

  // Buttons
  btn:      { minHeight: 54, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 18, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  btnGreen: { backgroundColor: '#16A34A', shadowColor: '#16A34A' },
  btnOff:   { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  btnTxt:   { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  btnChip:  { width: 26, height: 26, borderRadius: 7, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },

  ghost:       { minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: '#F0F4FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 7 },
  ghostOff:    { opacity: 0.6 },
  ghostTxt:    { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  ghostTxtOff: { color: '#94A3B8' },

  loginRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginTxt:  { fontSize: 13, color: '#64748B' },
  loginLink: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
});