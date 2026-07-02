import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  StatusBar,
  Platform,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { 
  User as UserIcon, 
  Mail, 
  Lock, 
  ChevronRight, 
  ChevronLeft,
  LogOut, 
  Target, 
  Users,
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  Circle,
  Weight,
  Calendar,
  Heart,
  Pencil,
  Apple,
  Chrome,
  ShieldCheck,
  RefreshCw,
  Trash2,
  MapPin,
  MessageSquare,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { API_BASE_URL } from '@/config/api';
import { PRIVACY_POLICY_URL } from '@/config/legal';
import { useHealthSync } from '@/hooks/useHealthSteps';
import { useRouter } from 'expo-router';
import { useTabBar } from '@/contexts/TabBarContext';
import { useFocusEffect } from '@react-navigation/native';
import Phase0Auth from '@/components/onboarding/Phase0Auth';
import {
  ensureNotificationPermissionAsync,
  getPushPermissionStatus,
} from '@/utils/pushNotifications';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  cacheNotificationPreferences,
  hasRemoteNotificationsEnabled,
  normalizeNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from '@/utils/notificationPreferences';
import {
  loadNotificationSettings,
  syncRemotePushTokenForPreferences,
} from '@/utils/notificationRegistration';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const { width } = Dimensions.get('window');

const THEME = {
  primary: '#FF6B6B',
  primaryDark: '#EE5253',
  waveAccent: '#FF8E8E',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  textMain: '#0F172A',
  textMuted: '#64748B',
  indigo: '#6366F1',
  glass: 'rgba(255, 255, 255, 0.16)',
  glassBorder: 'rgba(255, 255, 255, 0.24)',
};

const SETTINGS_ICON_COLOR = THEME.primary;

const FALLBACK_TIMEZONES = [
  'UTC', 'Africa/Lagos', 'Africa/Johannesburg', 'America/New_York', 
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 
  'America/Sao_Paulo', 'America/Mexico_City', 'Asia/Dubai', 
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Singapore', 
  'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 
  'Europe/Istanbul', 'Europe/Moscow', 'Australia/Sydney', 
  'Australia/Perth', 'Pacific/Auckland'
];

function getAllTimeZones() {
  try {
    const intlWithSupportedValues = Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[];
    };

    const supported =
      typeof intlWithSupportedValues.supportedValuesOf === 'function'
        ? intlWithSupportedValues.supportedValuesOf('timeZone')
        : [];

    return Array.from(new Set(['UTC', ...supported, ...FALLBACK_TIMEZONES])).sort((a, b) => {
      if (a === 'UTC') return -1;
      if (b === 'UTC') return 1;
      return a.localeCompare(b);
    });
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

function getDeviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const TIMEZONES = getAllTimeZones();

const GENDER_OPTIONS = ['male', 'female'] as const;
const REMOTE_NOTIFICATION_KEYS: NotificationPreferenceKey[] = [
  'partnerChat',
  'raceInvite',
  'raceUpdates',
  'partnerInviteAccepted',
];

/**
 * Account/Profile & Login/Register Screen
 */
export default function LoginScreen() {
  const { user, login, register, socialLogin, logout, deleteAccount, authFetch, isAuthenticated, accessToken, loading: authLoading } = useAuth();
  const { access, hasAccess, openManageSubscriptions } = useEntitlement();
  const router = useRouter();
  const { setTabBarVisible } = useTabBar();
  const extra: any = Constants.expoConfig?.extra ?? (Constants as any).manifest2?.extra ?? {};
  const oauth = extra.oauth ?? {};
  const googleOAuth = oauth.google ?? {};
  const deviceTimezone = React.useMemo(() => getDeviceTimezone(), []);

  // Hide TabBar when this screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setTabBarVisible(false);
      return () => setTabBarVisible(true);
    }, [setTabBarVisible])
  );

  const { isAuthorized: isHealthConnected } = useHealthSync({ 
    enabled: isAuthenticated, 
    accessToken: accessToken 
  });

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const lastHandledGoogleResponseRef = useRef<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [fetchingData, setFetchingData] = useState(false);

  // Edit State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [pushPermissionStatus, setPushPermissionStatus] = useState('undetermined');
  const [notificationLoadingKey, setNotificationLoadingKey] = useState<NotificationPreferenceKey | null>(null);

  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useAuthRequest({
    clientId: googleOAuth.expoClientId,
    iosClientId: googleOAuth.iosClientId,
    androidClientId: googleOAuth.androidClientId,
    webClientId: googleOAuth.webClientId,
    responseType: 'code',
    shouldAutoExchangeCode: true,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    const run = async () => {
      if (!googleResponse) return;

      const responseKey = JSON.stringify({
        type: googleResponse.type,
        code: (googleResponse as any)?.params?.code ?? null,
        idToken:
          (googleResponse as any)?.authentication?.idToken ??
          (googleResponse as any)?.authentication?.id_token ??
          null,
      });
      if (lastHandledGoogleResponseRef.current === responseKey) {
        return;
      }

      if (googleResponse.type !== 'success') {
        lastHandledGoogleResponseRef.current = responseKey;
        setSocialLoading((prev) => (prev === 'google' ? null : prev));
        return;
      }

      lastHandledGoogleResponseRef.current = responseKey;

      const autoIdToken =
        (googleResponse.authentication as any)?.idToken ||
        (googleResponse.authentication as any)?.id_token;
      const authCode = (googleResponse.params as any)?.code;
      const codeVerifier = (googleRequest as any)?.codeVerifier;
      const redirectUri = (googleRequest as any)?.redirectUri;
      const clientId =
        (googleRequest as any)?.clientId ||
        (Platform.OS === 'ios'
          ? googleOAuth.iosClientId
          : Platform.OS === 'android'
            ? googleOAuth.androidClientId
            : googleOAuth.webClientId) ||
        googleOAuth.expoClientId;

      if (!autoIdToken && (!authCode || !codeVerifier || !redirectUri || !clientId)) {
        setSocialLoading(null);
        Alert.alert('Google Login Failed', 'Missing Google auth code or PKCE values.');
        return;
      }

      try {
        let idToken = autoIdToken;
        if (!idToken) {
          const tokenRes: any = await AuthSession.exchangeCodeAsync(
            {
              clientId,
              code: authCode!,
              redirectUri,
              extraParams: {
                code_verifier: codeVerifier!,
              },
            } as any,
            GOOGLE_DISCOVERY as any
          );

          idToken = tokenRes?.idToken || tokenRes?.id_token || tokenRes?.params?.id_token;
        }
        if (!idToken) {
          throw new Error('Google token exchange did not return an ID token.');
        }

        await socialLogin('google', idToken, name.trim() || undefined);
      } catch (err: any) {
        Alert.alert('Google Login Failed', err?.message || 'Unable to continue with Google.');
      } finally {
        setSocialLoading(null);
      }
    };

    run();
  }, [googleResponse, googleRequest, socialLogin, name, googleOAuth.iosClientId, googleOAuth.androidClientId, googleOAuth.webClientId, googleOAuth.expoClientId]);

  const loadNotificationPreferences = React.useCallback(async () => {
    try {
      const { permissionStatus, preferences } = await loadNotificationSettings(authFetch, isAuthenticated);

      setNotificationPreferences(preferences);
      setPushPermissionStatus(permissionStatus);
    } catch (err) {
      console.log('Error loading notification preferences:', err);
    }
  }, [authFetch, isAuthenticated]);

  const fetchUserData = async () => {
    try {
      setFetchingData(true);
      
      const profRes = await authFetch(`${API_BASE_URL}/profile`);
      if (profRes.ok) {
        const data = await profRes.json();
        setProfileData(data.user);
        const normalizedPreferences = normalizeNotificationPreferences(data?.user?.notificationPreferences);
        setNotificationPreferences(normalizedPreferences);
        await cacheNotificationPreferences(normalizedPreferences);
      }

      const planRes = await authFetch(`${API_BASE_URL}/plan`);
      if (planRes.ok) {
        const data = await planRes.json();
        setPlanData(data.plan);
      }

      const partRes = await authFetch(`${API_BASE_URL}/partner`);
      if (partRes.ok) {
        const data = await partRes.json();
        setPartnerData(data);
      }
    } catch (err) {
      console.log('Error fetching user data:', err);
    } finally {
      setFetchingData(false);
    }
  };

  // Fetch full profile and plan data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setPushPermissionStatus('undetermined');
      setNotificationLoadingKey(null);
      return;
    }

    loadNotificationPreferences();
  }, [isAuthenticated, loadNotificationPreferences]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated) return;
      loadNotificationPreferences();
    }, [isAuthenticated, loadNotificationPreferences])
  );

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    try {
      setLoading(true);
      await register(name, email, password);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (loading || socialLoading) return;

    const hasGoogleClientId =
      !!googleOAuth.expoClientId ||
      !!googleOAuth.iosClientId ||
      !!googleOAuth.androidClientId ||
      !!googleOAuth.webClientId;

    if (!hasGoogleClientId) {
      Alert.alert(
        'Google Auth Not Configured',
        'Add Google OAuth client IDs to app.json > expo.extra.oauth.google before using Google sign-in.'
      );
      return;
    }

    try {
      setSocialLoading('google');
      const result = await promptGoogleAuth();
      if (result.type !== 'success') {
        setSocialLoading(null);
      }
    } catch (err: any) {
      setSocialLoading(null);
      Alert.alert('Google Login Failed', err?.message || 'Unable to start Google sign-in.');
    }
  };

  const handleAppleAuth = async () => {
    if (loading || socialLoading) return;

    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Sign In', 'Apple Sign In is only available on iOS.');
      return;
    }

    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert('Apple Sign In Unavailable', 'Apple Sign In is not available on this device.');
        return;
      }

      setSocialLoading('apple');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const appleName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();

      await socialLogin('apple', credential.identityToken, appleName || name.trim() || undefined);
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      Alert.alert('Apple Login Failed', err?.message || 'Unable to continue with Apple.');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout }
    ]);
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeleteLoading(true);
      await deleteAccount();
    } catch (err: any) {
      Alert.alert('Delete Failed', err?.message || 'Unable to delete account right now.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deleteLoading) return;

    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  };

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      Alert.alert('Unable to Open', 'Could not open the privacy policy right now.');
    }
  };

  const handleToggleNotificationPreference = async (key: NotificationPreferenceKey) => {
    if (notificationLoadingKey) return;

    const previousPreferences = notificationPreferences;
    const nextPreferences = normalizeNotificationPreferences({
      ...notificationPreferences,
      [key]: !notificationPreferences[key],
    });
    const nextEnabled = nextPreferences[key];
    const previousRemoteEnabled = hasRemoteNotificationsEnabled(previousPreferences);
    const nextRemoteEnabled = hasRemoteNotificationsEnabled(nextPreferences);
    let latestPermissionStatus = pushPermissionStatus;

    try {
      setNotificationLoadingKey(key);
      setNotificationPreferences(nextPreferences);
      await cacheNotificationPreferences(nextPreferences);

      latestPermissionStatus = await getPushPermissionStatus();

      if (nextEnabled) {
        latestPermissionStatus = await ensureNotificationPermissionAsync();
        setPushPermissionStatus(latestPermissionStatus);
      }

      const response = await authFetch(`${API_BASE_URL}/profile/notification-preferences`, {
        method: 'POST',
        body: JSON.stringify({
          preferences: {
            [key]: nextEnabled,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Could not update notification preferences.');
      }

      const responseJson = await response.json();
      const savedPreferences = normalizeNotificationPreferences(
        responseJson?.preferences ?? responseJson?.user?.notificationPreferences ?? nextPreferences
      );

      setNotificationPreferences(savedPreferences);
      setProfileData((prev: any) =>
        prev
          ? {
              ...prev,
              notificationPreferences: savedPreferences,
            }
          : prev
      );
      await cacheNotificationPreferences(savedPreferences);

      const changedRemoteToggle = REMOTE_NOTIFICATION_KEYS.includes(key);
      const shouldSyncRemotePushToken =
        previousRemoteEnabled !== nextRemoteEnabled ||
        (changedRemoteToggle && nextRemoteEnabled && latestPermissionStatus === 'granted');

      if (shouldSyncRemotePushToken) {
        latestPermissionStatus = await syncRemotePushTokenForPreferences(authFetch, savedPreferences);
        setPushPermissionStatus(latestPermissionStatus);
      }

      if (nextEnabled && latestPermissionStatus !== 'granted') {
        const remoteLabel = REMOTE_NOTIFICATION_KEYS.includes(key) ? 'push alerts' : 'reminders';

        if (latestPermissionStatus === 'denied') {
          Alert.alert(
            'Notifications Blocked',
            `System notifications are blocked. Enable them in Settings to receive ${remoteLabel}.`,
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert('Permission Needed', `Allow notifications to receive ${remoteLabel}.`);
        }
      }
    } catch (err: any) {
      setNotificationPreferences(previousPreferences);
      await cacheNotificationPreferences(previousPreferences);
      setPushPermissionStatus(await getPushPermissionStatus());
      Alert.alert('Notification Update Failed', err?.message || 'Could not update notification preferences.');
    } finally {
      setNotificationLoadingKey(null);
    }
  };

  const handleEditPress = (field: string, currentVal: any) => {
    setEditingField(field);
    if (field === 'gender') {
      const normalized = String(currentVal || '').trim().toLowerCase();
      setEditValue(GENDER_OPTIONS.includes(normalized as (typeof GENDER_OPTIONS)[number]) ? normalized : '');
    } else {
      setEditValue(String(currentVal || ''));
    }
    setEditModalVisible(true);
  };

  const handleSaveUpdate = async () => {
    if (!editingField) return;

    try {
      setUpdateLoading(true);
      
      const body: any = {};
      if (editingField === 'weightKg') body.weightKg = parseFloat(editValue);
      else if (editingField === 'age') body.age = parseInt(editValue, 10);
      else if (editingField === 'gender') {
        const normalizedGender = editValue.trim().toLowerCase();
        if (!GENDER_OPTIONS.includes(normalizedGender as (typeof GENDER_OPTIONS)[number])) {
          Alert.alert('Invalid Gender', 'Gender must be Male or Female.');
          return;
        }
        body.gender = normalizedGender;
      }
      else if (editingField === 'timezone') body.timezone = editValue;

      const res = await authFetch(`${API_BASE_URL}/profile`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (res.ok) {
        await fetchUserData();
        setEditModalVisible(false);
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.message || 'Failed to update profile');
      }
    } catch (err) {
      console.log('Update profile error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setUpdateLoading(false);
    }
  };

  const isSubmittingAuth = loading || !!socialLoading;
  const handleManualAuth = () => {
    setMode('register');
    setShowEmailAuth(true);
  };
  const handleManualLogin = () => {
    setMode('login');
    setShowEmailAuth(true);
  };

  if (authLoading || (isAuthenticated && fetchingData)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  if (!isAuthenticated && !showEmailAuth) {
    return (
      <Phase0Auth
        onNext={handleManualAuth}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace('/Onboarding' as any);
        }}
        onGooglePress={handleGoogleAuth}
        onApplePress={handleAppleAuth}
        onManualPress={handleManualAuth}
        onLoginPress={handleManualLogin}
        socialLoading={socialLoading}
        disabled={isSubmittingAuth}
      />
    );
  }

  // --- AUTH VIEW ---
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.authContainerOuter}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          contentContainerStyle={styles.authScroll}
          bounces={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            onPress={() => setShowEmailAuth(false)} 
            style={{ marginBottom: 24, alignSelf: 'flex-start' }}
          >
            <ChevronLeft color={THEME.textMain} size={28} />
          </TouchableOpacity>

          <View style={styles.textGroup}>
            <Text style={styles.authTitle}>
              {mode === 'login' ? 'Welcome Back' : 'Join the Team'}
            </Text>
            <Text style={styles.authSubtitle}>
              {mode === 'login' 
                ? 'Great to see you again! Log in to sync with your partner.' 
                : 'Start your synchronized fitness journey today.'}
            </Text>
          </View>


            <View style={styles.authForm}>
              {mode === 'register' && (
                <View style={styles.inputWrapper}>
                  <View style={styles.iconBox}>
                    <UserIcon size={20} color={THEME.primary} />
                  </View>
                  <TextInput
                    placeholder="What should we call you?"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.inputWrapper}>
                <View style={styles.iconBox}>
                  <Mail size={20} color={THEME.primary} />
                </View>
                <TextInput
                  placeholder="Your email address"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputWrapper}>
                <View style={styles.iconBox}>
                  <Lock size={20} color={THEME.primary} />
                </View>
                <TextInput
                  placeholder={mode === 'login' ? 'Your password' : 'Create a password'}
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  secureTextEntry
                />
              </View>

              {mode === 'register' && (
                <View style={styles.inputWrapper}>
                  <View style={styles.iconBox}>
                    <Lock size={20} color={THEME.primary} />
                  </View>
                  <TextInput
                    placeholder="Confirm password"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.input}
                    secureTextEntry
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.mainButton}
                onPress={mode === 'login' ? handleLogin : handleRegister}
                disabled={isSubmittingAuth}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[THEME.primary, '#F43F5E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.mainButtonGradient}
                >
                  {isSubmittingAuth ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.mainButtonText}>
                        {mode === 'login' ? 'Log In' : 'Create Account'}
                      </Text>
                      <ChevronRight color="#FFFFFF" size={20} strokeWidth={3} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.socialDivider}>
                <View style={styles.socialDividerLine} />
                <Text style={styles.socialDividerText}>OR</Text>
                <View style={styles.socialDividerLine} />
              </View>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleAuth}
                disabled={isSubmittingAuth}
              >
                {socialLoading === 'google' ? (
                  <ActivityIndicator size="small" color={THEME.textMain} />
                ) : (
                  <Chrome size={18} color={THEME.textMain} />
                )}
                <Text style={styles.socialButtonText}>
                  {socialLoading === 'google'
                    ? 'Connecting to Google...'
                    : mode === 'register'
                      ? 'Sign up with Google'
                      : 'Continue with Google'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleAuth}
                disabled={isSubmittingAuth}
              >
                {socialLoading === 'apple' ? (
                  <ActivityIndicator size="small" color={THEME.textMain} />
                ) : (
                  <Apple size={18} color={THEME.textMain} />
                )}
                <Text style={styles.socialButtonText}>
                  {socialLoading === 'apple'
                    ? 'Connecting to Apple...'
                    : mode === 'register'
                      ? 'Sign up with Apple'
                      : 'Continue with Apple'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
              >
                <Text style={styles.switchModeText}>
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <Text style={styles.switchModeLink}>{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPrivacyModalVisible(true)} style={{ marginTop: 12 }}>
                <Text style={[styles.privacyFinePrint, { textAlign: 'center' }]}>
                  View Privacy Disclosure & Encryption Details
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
      </SafeAreaView>
    );
  }

  // --- PROFILE VIEW ---
  const displayUser = profileData || user;
  const billing = access || displayUser?.billing;
  const effectiveHasAccess = hasAccess || !!billing?.hasAccess;
  const goal = planData?.goalType || displayUser?.goalType || 'Maintenance';
  const currentWeek = planData?.currentWeek || 0;

  const formatBillingDate = (value?: string | null) => {
    if (!value) return '--';
    const isoDateMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const [, year, month, day] = isoDateMatch;
      const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      return utcDate.toLocaleDateString(undefined, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    const dt = new Date(value);
    return Number.isNaN(dt.getTime())
      ? '--'
      : dt.toLocaleDateString(undefined, {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  const billingStatusLabel = (() => {
    if (!billing) return effectiveHasAccess ? 'ACTIVE' : 'LOCKED';
    if (billing.accessStatus === 'PARTNER_INCLUDED_ACTIVE') {
      return 'INCLUDED VIA PARTNER';
    }
    if (billing.accessStatus === 'PARTNER_INCLUDED_GRACE') {
      return 'PARTNER GRACE';
    }
    switch (billing.accessStatus) {
      case 'TRIAL_ACTIVE':
        return 'TRIAL ACTIVE';
      case 'PREMIUM_ACTIVE':
        return billing.premiumIsLifetime ? 'LIFETIME' : 'PREMIUM';
      case 'PREMIUM_GRACE':
        return 'GRACE PERIOD';
      case 'TRIAL_EXPIRED':
        return 'TRIAL EXPIRED';
      case 'MANUAL_OVERRIDE':
        return 'ACCESS OVERRIDE';
      default:
        return effectiveHasAccess ? 'ACTIVE' : 'LOCKED';
    }
  })();

  const isPartnerIncludedAccess = billing?.accessSource === 'partner' && effectiveHasAccess;
  const isPartnerGrace = billing?.accessStatus === 'PARTNER_INCLUDED_GRACE';
  const premiumAccessDetail = (() => {
    if (!effectiveHasAccess) return 'Locked';
    if (isPartnerIncludedAccess) {
      const partnerName = billing?.sharedByPartnerName || partnerData?.partner?.displayName || 'your partner';
      return `Included via ${partnerName}`;
    }
    return 'Unlocked';
  })();
  const premiumEndsLabel = (() => {
    if (isPartnerGrace) return formatBillingDate(billing?.sharedAccessEndsAt);
    if (isPartnerIncludedAccess) return 'While you stay connected';
    return billing?.premiumIsLifetime ? 'Never (Lifetime)' : formatBillingDate(billing?.premiumExpiresAt);
  })();
  const premiumEndsTitle = isPartnerGrace ? 'Partner grace ends' : 'Premium expires';

  const getNotificationStatusLabel = (key: NotificationPreferenceKey) => {
    if (notificationLoadingKey === key) return 'Updating...';
    if (!notificationPreferences[key]) return 'Off';
    if (pushPermissionStatus === 'granted') return 'On';
    if (pushPermissionStatus === 'denied') return 'Blocked in Settings';
    return 'Needs Permission';
  };

  const notificationToggleRows: {
    key: NotificationPreferenceKey;
    icon: React.ReactNode;
    label: string;
    description: string;
  }[] = [
    {
      key: 'partnerChat',
      icon: <Bell size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Partner chat alerts',
      description: 'Push notifications for new partner chat messages.',
    },
    {
      key: 'raceInvite',
      icon: <Target size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Race invites',
      description: 'Push alerts when your partner challenges you to a race.',
    },
    {
      key: 'raceUpdates',
      icon: <Activity size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Race updates',
      description: 'Push alerts for accepted, declined, and completed races.',
    },
    {
      key: 'scheduledRunReminder',
      icon: <Calendar size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Scheduled run reminders',
      description: 'Local reminders 30 minutes before an accepted run together.',
    },
    {
      key: 'partnerInviteAccepted',
      icon: <Users size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Partner invite accepted',
      description: 'Push alerts when someone accepts your partner invite.',
    },
    {
      key: 'dailyPlanReminder',
      icon: <Clock size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Daily plan reminder',
      description: "Morning reminder with today's target steps, calories, and run plan.",
    },
    {
      key: 'mealLoggingReminder',
      icon: <Apple size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Meal logging reminders',
      description: 'Local lunch and dinner reminders to log meals.',
    },
    {
      key: 'stepTargetReminder',
      icon: <Activity size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Step target at risk',
      description: "Evening reminder when you're still behind today's step target.",
    },
    {
      key: 'weeklyQuestReminder',
      icon: <CheckCircle2 size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Weekly quest ready',
      description: 'Local reminder when a quest reward is ready to redeem.',
    },
    {
      key: 'billingReminder',
      icon: <ShieldCheck size={16} color={SETTINGS_ICON_COLOR} />,
      label: 'Trial and billing reminder',
      description: 'Local reminder before your trial ends or subscription changes.',
    },
  ];

  const renderSettingsRow = ({
    icon,
    label,
    value,
    onPress,
    last = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onPress?: () => void;
    last?: boolean;
  }) => {
    const row = (
      <View style={[styles.settingsRow, !last && styles.settingsRowBorder]}>
        <View style={styles.settingsRowLeft}>
          <View style={styles.settingsRowIcon}>
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<{ color?: string }>, { color: SETTINGS_ICON_COLOR })
              : icon}
          </View>
          <Text style={styles.settingsRowLabel}>{label}</Text>
        </View>
        <View style={styles.settingsRowRight}>
          <Text style={styles.settingsRowValue} numberOfLines={1}>
            {value}
          </Text>
          {onPress ? <ChevronRight size={16} color="#94A3B8" /> : null}
        </View>
      </View>
    );

    if (!onPress) return row;

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {row}
      </TouchableOpacity>
    );
  };

  const renderNotificationToggleRow = ({
    preferenceKey,
    icon,
    label,
    description,
    enabled,
    onPress,
  }: {
    preferenceKey: NotificationPreferenceKey;
    icon: React.ReactNode;
    label: string;
    description: string;
    enabled: boolean;
    status: string;
    onPress: () => void;
    last?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.premiumToggleRow} 
      onPress={onPress} 
      activeOpacity={0.7}
      disabled={!!notificationLoadingKey}
    >
      <View style={styles.premiumToggleRowLeft}>
        <View style={[styles.disclosureIconCircle, { backgroundColor: enabled ? THEME.primary + '10' : '#F8FAFC' }]}>
          {React.cloneElement(icon as React.ReactElement<{ color?: string }>, { color: enabled ? THEME.primary : '#94A3B8' })}
        </View>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.premiumToggleLabel}>{label}</Text>
          <Text style={styles.premiumToggleDescription} numberOfLines={2}>{description}</Text>
        </View>
      </View>
      
      <View style={[
        styles.customSwitch,
        enabled ? styles.customSwitchEnabled : styles.customSwitchDisabled
      ]}>
        <View style={[
          styles.customSwitchKnob,
          enabled ? styles.customSwitchKnobEnabled : styles.customSwitchKnobDisabled
        ]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.profileContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ScrollView 
        style={{ flex: 1, backgroundColor: THEME.primary }} 
        contentContainerStyle={{ backgroundColor: THEME.bg }}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
      >
        <LinearGradient 
          colors={[THEME.primary, '#F43F5E']} 
          style={styles.profileHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative Background Elements */}
          <View style={styles.headerBlob1} />
          <View style={styles.headerBlob2} />

          <View style={styles.topActions}>
            <TouchableOpacity onPress={() => router.back()} style={styles.glassBtn}>
              <ChevronLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenterTitle}>
              <Text style={styles.headerTitleText}>Profile</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtnModern}>
              <LogOut size={14} color="#FFFFFF" />
              <Text style={styles.logoutBtnTextModern}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileSummaryMain}>
            <View style={styles.avatarContainerModern}>
              <View style={styles.avatarModern}>
                <Text style={styles.avatarTextModern}>
                  {displayUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.statusBadgeModern}>
                <View style={[styles.statusDotModern, { backgroundColor: '#4ADE80' }]} />
              </View>
            </View>

            <View style={styles.profileSummaryTextModern}>
              <Text style={styles.profileNameModern}>{displayUser?.displayName || 'User'}</Text>
              <Text style={styles.profileEmailModern}>{displayUser?.email}</Text>
              <TouchableOpacity 
                style={styles.timezoneBadgeModern}
                onPress={() => handleEditPress('timezone', displayUser?.timezone)}
              >
                <Clock size={11} color="rgba(255,255,255,0.9)" style={{ marginRight: 5 }} />
                <Text style={styles.timezoneTextModern}>{displayUser?.timezone || 'UTC'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.glassStats}>
            <View style={styles.headerStatItemModern}>
              <Text style={styles.headerStatValueModern}>{displayUser?.age || '--'}</Text>
              <Text style={styles.microTagModern}>AGE</Text>
            </View>
            <View style={styles.headerStatDividerModern} />
            <View style={styles.headerStatItemModern}>
              <Text style={styles.headerStatValueModern}>{displayUser?.weightKg?.toFixed(1) || '--'}</Text>
              <Text style={styles.microTagModern}>KG</Text>
            </View>
            <View style={styles.headerStatDividerModern} />
            <View style={styles.headerStatItemModern}>
              <Text style={styles.headerStatValueModern}>Wk {currentWeek}</Text>
              <Text style={styles.microTagModern}>PLAN</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.profileBody}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
            <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: <Weight size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Weight',
              value: `${displayUser?.weightKg || '--'} kg`,
              onPress: () => handleEditPress('weightKg', displayUser?.weightKg),
            })}
            {renderSettingsRow({
              icon: <Activity size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Gender',
              value: displayUser?.gender?.toUpperCase() || 'Not set',
              onPress: () => handleEditPress('gender', displayUser?.gender),
            })}
            {renderSettingsRow({
              icon: <Calendar size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Age',
              value: displayUser?.age ? `${displayUser.age} yrs` : '--',
              onPress: () => handleEditPress('age', displayUser?.age),
            })}
            {renderSettingsRow({
              icon: <Target size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Units',
              value: displayUser?.units?.toUpperCase() || 'METRIC',
            })}
            {renderSettingsRow({
              icon: <Clock size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Timezone',
              value: displayUser?.timezone || 'UTC',
              onPress: () => handleEditPress('timezone', displayUser?.timezone),
              last: true,
            })}
          </View>

          <Text style={styles.sectionTitle}>Goals</Text>
          <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: <Target size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Primary Goal',
              value: goal.replace('_', ' '),
              onPress: () => {}, // Future edit goal
              last: true,
            })}
          </View>

          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingsCardHeader}>
              <View style={styles.settingsCardHeaderLeft}>
                <View style={[styles.settingsCardIcon, { backgroundColor: '#FFF1F2' }]}>
                  <ShieldCheck size={18} color={SETTINGS_ICON_COLOR} />
                </View>
                <View>
                  <Text style={styles.settingsCardTitle}>Premium Access</Text>
                  <Text style={styles.settingsCardSubtitle}>Trial and subscription status</Text>
                </View>
              </View>
              <View
                style={[
                  styles.subscriptionBadge,
                  { backgroundColor: (effectiveHasAccess ? '#DCFCE7' : '#FEE2E2') }
                ]}
              >
                <Text
                  style={[
                    styles.subscriptionBadgeText,
                    { color: effectiveHasAccess ? '#15803D' : '#B91C1C' }
                  ]}
                >
                  {billingStatusLabel}
                </Text>
              </View>
            </View>

            {renderSettingsRow({
              icon: <CheckCircle2 size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Access',
              value: premiumAccessDetail,
            })}
            {renderSettingsRow({
              icon: <Clock size={16} color={SETTINGS_ICON_COLOR} />,
              label: premiumEndsTitle,
              value: premiumEndsLabel,
              last: true,
            })}

            <View style={styles.subscriptionActions}>
                <TouchableOpacity
                  style={[styles.subscriptionButton, styles.subscriptionButtonPrimary]}
                  onPress={() => {
                    if (isPartnerIncludedAccess) {
                      router.push('/paywall' as any);
                      return;
                    }
                    router.push('/paywall?mode=manage' as any);
                  }}
                >
                  <Text style={styles.subscriptionButtonPrimaryText}>
                    {isPartnerIncludedAccess ? 'View Plans' : effectiveHasAccess ? 'Manage Subscription' : 'View Plans'}
                </Text>
              </TouchableOpacity>
              {!isPartnerIncludedAccess && (
                <TouchableOpacity
                  style={[styles.subscriptionButton, styles.subscriptionButtonSecondary]}
                  onPress={async () => {
                    try {
                      await openManageSubscriptions();
                    } catch {
                      Alert.alert('Unable to Open', 'Could not open subscription management.');
                    }
                  }}
                >
                  <Text style={styles.subscriptionButtonSecondaryText}>Cancel Subscription</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: <Bell size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Notification Preferences',
              value: 'Manage',
              onPress: () => setNotificationsModalVisible(true),
              last: true,
            })}
          </View>

          <Text style={styles.sectionTitle}>Connectivity</Text>
          <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: <Heart size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Apple Health / Google Fit',
              value: isHealthConnected ? 'Connected' : 'Disconnected',
            })}
            {renderSettingsRow({
              icon: <Users size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Partner',
              value: partnerData?.hasPartner ? partnerData.partner.displayName : 'No partner linked',
              onPress: () => router.push('/Partner' as any),
              last: true,
            })}
          </View>

          <Text style={styles.sectionTitle}>Privacy & Data</Text>
          <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: <ShieldCheck size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Data Disclosure',
              value: 'View Details',
              onPress: () => setPrivacyModalVisible(true),
            })}
            {renderSettingsRow({
              icon: <ShieldCheck size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Privacy Policy',
              value: 'Open External',
              onPress: openPrivacyPolicy,
              last: true,
            })}
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsCard}>
            {renderSettingsRow({
              icon: <Trash2 size={16} color={SETTINGS_ICON_COLOR} />,
              label: 'Delete Account',
              value: 'Permanent',
              onPress: handleDeleteAccount,
              last: true,
            })}
          </View>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingField === 'weightKg' ? 'Edit Weight' : 
               editingField === 'age' ? 'Edit Age' : 
               editingField === 'timezone' ? 'Select Time Zone' : 'Edit Gender'}
            </Text>
            
            {editingField === 'timezone' ? (
              <ScrollView style={styles.timezoneScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.tzItem, editValue === deviceTimezone && styles.tzItemSelected]}
                  onPress={() => setEditValue(deviceTimezone)}
                >
                  <Text style={[styles.tzItemText, editValue === deviceTimezone && styles.tzItemTextSelected]}>
                    {`Use Device Timezone (${deviceTimezone})`}
                  </Text>
                  {editValue === deviceTimezone && <CheckCircle2 size={16} color={THEME.primary} />}
                </TouchableOpacity>
                {TIMEZONES.map((tz) => (
                  <TouchableOpacity 
                    key={tz} 
                    style={[styles.tzItem, editValue === tz && styles.tzItemSelected]}
                    onPress={() => setEditValue(tz)}
                  >
                    <Text style={[styles.tzItemText, editValue === tz && styles.tzItemTextSelected]}>{tz}</Text>
                    {editValue === tz && <CheckCircle2 size={16} color={THEME.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : editingField === 'gender' ? (
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[styles.tzItem, editValue === gender && styles.tzItemSelected]}
                    onPress={() => setEditValue(gender)}
                  >
                    <Text style={[styles.tzItemText, editValue === gender && styles.tzItemTextSelected]}>
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </Text>
                    {editValue === gender && <CheckCircle2 size={16} color={THEME.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.modalInput}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType={editingField === 'gender' ? 'default' : 'numeric'}
                placeholder={`Enter new ${editingField}`}
                autoFocus
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn, { backgroundColor: THEME.primary }]} onPress={handleSaveUpdate} disabled={updateLoading}>
                {updateLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Privacy Detail Modal */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 32 }]}>
            <TouchableOpacity 
              style={styles.modalCloseIcon} 
              onPress={() => setPrivacyModalVisible(false)}
            >
              <X size={20} color={THEME.textMuted} />
            </TouchableOpacity>
            <View style={[styles.settingsCardIcon, { backgroundColor: '#EFF6FF', alignSelf: 'center', marginBottom: 16 }]}>
              <ShieldCheck size={24} color="#2563EB" />
            </View>
            <Text style={[styles.modalTitle, { fontSize: 20, marginBottom: 8, textAlign: 'center' }]}>Privacy & Data</Text>
            <Text style={[styles.privacyFinePrint, { textAlign: 'center', marginBottom: 32, paddingHorizontal: 20, fontSize: 13, lineHeight: 18 }]}>
              Retaining your trust is our priority. Here is a summary of what data is collected.
            </Text>

            <View style={[styles.privacySummarySubtle, { width: '100%', gap: 20 }]}>
              <View style={styles.disclosureRow}>
                <View style={[styles.disclosureIconCircle, { backgroundColor: '#F0F9FF' }]}>
                  <Mail size={16} color="#0EA5E9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disclosureLabelText}>Contact Info</Text>
                  <Text style={styles.disclosureValueText}>Name, email, and subscription data.</Text>
                </View>
              </View>

              <View style={styles.disclosureRow}>
                <View style={[styles.disclosureIconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Activity size={16} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disclosureLabelText}>Health & Activity</Text>
                  <Text style={styles.disclosureValueText}>Steps, workouts, and wellness metrics.</Text>
                </View>
              </View>

              <View style={styles.disclosureRow}>
                <View style={[styles.disclosureIconCircle, { backgroundColor: '#FFF7ED' }]}>
                  <MapPin size={16} color="#F97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disclosureLabelText}>Location & Media</Text>
                  <Text style={styles.disclosureValueText}>Routes and photos used for features.</Text>
                </View>
              </View>

              <View style={styles.disclosureRow}>
                <View style={[styles.disclosureIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <MessageSquare size={16} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disclosureLabelText}>App Stability</Text>
                  <Text style={styles.disclosureValueText}>Notifications and analytics data.</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalBtn, { width: '100%', marginTop: 32, backgroundColor: THEME.primary, height: 50 }]} 
              onPress={() => setPrivacyModalVisible(false)}
            >
              <Text style={[styles.modalSaveText, { fontSize: 16 }]}>I Understand</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openPrivacyPolicy}
              style={{ marginTop: 16, paddingVertical: 10 }}
            >
              <Text style={[styles.privacyFinePrint, { color: THEME.textMuted, textDecorationLine: 'underline', textAlign: 'center' }]}>
                Full Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={notificationsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotificationsModalVisible(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <View style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHandle} />
            
            <TouchableOpacity 
              style={styles.modalCloseIcon} 
              onPress={() => setNotificationsModalVisible(false)}
            >
              <X size={20} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <View style={[styles.settingsCardIcon, { backgroundColor: '#FFF1F2', alignSelf: 'center', marginBottom: 12, marginTop: 20 }]}>
              <Bell size={24} color={THEME.primary} />
            </View>
            <Text style={[styles.modalTitle, { fontSize: 22, marginBottom: 4, textAlign: 'center' }]}>Notifications</Text>
            <Text style={[styles.privacyFinePrint, { textAlign: 'center', marginBottom: 24, paddingHorizontal: 40, fontSize: 13, lineHeight: 18 }]}>
              Choose exactly how you stay in the loop.
            </Text>

            <ScrollView 
              style={{ flex: 1, width: '100%' }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
            >
              {pushPermissionStatus === 'denied' && (
                <View style={[styles.settingsCard, { marginBottom: 20, backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 }]}>
                  <Text style={[styles.disclosureLabelText, { color: '#92400E' }]}>System Permissions Off</Text>
                  <Text style={[styles.disclosureValueText, { color: '#B45309', marginBottom: 10 }]}>
                    To receive any alerts, you must enable notifications in your device settings.
                  </Text>
                  <TouchableOpacity 
                    onPress={() => Linking.openSettings()}
                    style={{ backgroundColor: '#B45309', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Open System Settings</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ paddingHorizontal: 20 }}>
                {notificationToggleRows.map((row, index) => (
                  <View key={row.key}>
                    {renderNotificationToggleRow({
                      preferenceKey: row.key,
                      icon: row.icon,
                      label: row.label,
                      description: row.description,
                      enabled: notificationPreferences[row.key],
                      status: getNotificationStatusLabel(row.key),
                      onPress: () => handleToggleNotificationPreference(row.key),
                      last: index === notificationToggleRows.length - 1,
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            <LinearGradient
              colors={['rgba(255,255,255,0)', '#FFFFFF']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, justifyContent: 'flex-end', padding: 20 }}
            >
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: THEME.primary, width: '100%', height: 50 }]} 
                onPress={() => setNotificationsModalVisible(false)}
              >
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  authContainerOuter: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  authScroll: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 15,
    paddingBottom: 24,
  },
  authHeroHeader: {
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  backBtnModern: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  authHeroTextWrap: {
    marginTop: 0,
  },
  authHeroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.8,
  },
  authHeroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
  },
  authContent: {
    flex: 1,
    paddingTop: 12,
  },
  textGroup: {
    marginBottom: 35,
  },
  authTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: THEME.textMain,
    letterSpacing: -2,
    lineHeight: 52,
    marginBottom: 12,
  },
  authSubtitle: {
    fontSize: 16,
    color: THEME.textMuted,
    lineHeight: 22,
    fontWeight: '500',
  },
  authForm: {
    gap: 12,
  },
  inputWrapper: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: THEME.textMain,
    fontWeight: '600',
  },
  mainButton: {
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: THEME.primary,
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  mainButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  socialDividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 1,
  },
  socialButton: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textMain,
  },
  switchMode: {
    marginTop: 12,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  switchModeLink: {
    fontWeight: '800',
    color: THEME.primary,
  },
  privacyFinePrint: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
    fontWeight: '500',
  },
  privacyFinePrintBold: {
    fontWeight: '700',
    color: '#64748B',
  },
  privacySummarySubtle: {
    marginTop: 12,
    gap: 8,
    paddingHorizontal: 4,
  },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  disclosureIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  disclosureLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textMain,
    marginBottom: 2,
  },
  disclosureValueText: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  profileContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  profileHeader: {
    paddingTop: 42,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  headerBlob1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerBlob2: {
    position: 'absolute',
    bottom: 20,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 10,
  },
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 10,
  },
  headerCenterTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitleText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  logoutBtnModern: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 6,
  },
  logoutBtnTextModern: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  profileSummaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 10,
  },
  avatarContainerModern: {
    position: 'relative',
  },
  avatarModern: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarTextModern: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.primary,
  },
  statusBadgeModern: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 8,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusDotModern: {
    width: 10,
    height: 10,
    borderRadius: 4,
  },
  profileSummaryTextModern: {
    flex: 1,
    marginLeft: 20,
  },
  profileNameModern: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  profileEmailModern: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginTop: 2,
  },
  timezoneBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timezoneTextModern: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  glassStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  headerStatItemModern: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatValueModern: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  headerStatDividerModern: {
    width: 1,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  microTagModern: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  profileBody: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textMain,
    marginTop: 32,
    marginBottom: 16,
  },
  timezoneScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  genderOptions: {
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  tzItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#F8FAFC',
  },
  tzItemSelected: {
    backgroundColor: THEME.primary + '10',
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  tzItemText: {
    fontSize: 14,
    color: THEME.textMain,
    fontWeight: '600',
  },
  tzItemTextSelected: {
    color: THEME.primary,
    fontWeight: '800',
  },
  settingsCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingVertical: 6,
  },
  settingsCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  settingsCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: THEME.textMain,
  },
  settingsCardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingsRowIcon: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  settingsRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMain,
  },
  notificationRow: {
    alignItems: 'flex-start',
  },
  notificationTextWrap: {
    flex: 1,
  },
  notificationRowDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '52%',
  },
  settingsRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMuted,
    textAlign: 'right',
    marginRight: 8,
  },
  notificationToggleWrap: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  notificationStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    marginBottom: 8,
  },
  notificationToggle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  notificationToggleEnabled: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  notificationToggleDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  notificationToggleBusy: {
    opacity: 0.7,
  },
  subscriptionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  subscriptionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subscriptionActions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  subscriptionButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionButtonPrimary: {
    backgroundColor: THEME.primary,
  },
  subscriptionButtonSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subscriptionButtonPrimaryText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subscriptionButtonSecondaryText: {
    color: THEME.textMain,
    fontSize: 12,
    fontWeight: '800',
  },
  privacySummaryFootnote: {
    color: THEME.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dangerHeaderText: {
    flex: 1,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#991B1B',
  },
  dangerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: '#7F1D1D',
  },
  dangerButton: {
    marginTop: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  dangerButtonDisabled: {
    opacity: 0.7,
  },
  dangerButtonText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.textMain,
    marginBottom: 20,
  },
  modalInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: THEME.textMain,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
    marginRight: 12,
  },
  modalSaveBtn: {
    backgroundColor: THEME.primary,
  },
  modalCancelText: {
    color: THEME.textMuted,
    fontWeight: '800',
  },
  modalSaveText: {
    color: '#FFF',
    fontWeight: '900',
  },
  modalCloseIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    zIndex: 10,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    width: '100%',
    height: '88%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 8,
  },
  premiumToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  premiumToggleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumToggleLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textMain,
    letterSpacing: -0.3,
  },
  premiumToggleDescription: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  customSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  customSwitchEnabled: {
    backgroundColor: THEME.primary,
  },
  customSwitchDisabled: {
    backgroundColor: '#E2E8F0',
  },
  customSwitchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  customSwitchKnobEnabled: {
    alignSelf: 'flex-end',
  },
  customSwitchKnobDisabled: {
    alignSelf: 'flex-start',
  },
});
