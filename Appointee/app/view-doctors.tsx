import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:8000/api';

interface Doctor {
  name: string;
  degree: string;
  email: string;
  mobile: string;
  city: string;
  address: string;
}

export default function ViewDoctors() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState('');
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    console.log('\n========== [FETCH DOCTORS] START ==========');
    
    try {
      const token = await AsyncStorage.getItem('mr_token');
      console.log('[FETCH DOCTORS] Token:', token ? 'Yes' : 'No');
      
      if (!token) {
        Alert.alert('Error', 'Please login again');
        router.replace('/mr-login');
        return;
      }

      console.log('[FETCH DOCTORS] Request URL:', `${API_BASE_URL}/mr/getDoctorsByCity`);
      
      const response = await axios.get(`${API_BASE_URL}/mr/getDoctorsByCity`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      console.log('[FETCH DOCTORS] Response:', response.data);
      
      if (response.data.success) {
        setDoctors(response.data.doctors);
        setCity(response.data.city);
        setCount(response.data.count);
        console.log(`[FETCH DOCTORS] Loaded ${response.data.count} doctors from ${response.data.city}`);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to fetch doctors');
      }
    } catch (error: any) {
      console.error('[FETCH DOCTORS] Error:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        router.replace('/mr-login');
      } else {
        Alert.alert('Error', 'Failed to load doctors. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('========== [FETCH DOCTORS] END ==========\n');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDoctors();
  };

  const handleBackPress = () => {
    console.log('[VIEW DOCTORS] Back button pressed, navigating to MR Dashboard');
    router.replace('/mr-dashboard');
  };

  const handleBookAppointment = (doctor: Doctor) => {
    console.log('[BOOK APPOINTMENT] Doctor:', doctor.name);
    Alert.alert(
      'Book Appointment',
      `Would you like to book an appointment with Dr. ${doctor.name}?\n\nContact: ${doctor.mobile}\nEmail: ${doctor.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book Now',
          onPress: () => {
            Alert.alert('Success', `Appointment request sent to Dr. ${doctor.name}`);
          },
        },
      ]
    );
  };

  const handleCallDoctor = (mobile: string) => {
    console.log('[CALL DOCTOR] Mobile:', mobile);
    Alert.alert('Call Doctor', `Would you like to call ${mobile}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => console.log('Calling...') },
    ]);
  };

  const handleEmailDoctor = (email: string) => {
    console.log('[EMAIL DOCTOR] Email:', email);
    Alert.alert('Email Doctor', `Would you like to email ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Email', onPress: () => console.log('Emailing...') },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading doctors...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctors in {city}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count} Doctors</Text>
        </View>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <MaterialIcons name="location-city" size={28} color="#7C3AED" />
        <View>
          <Text style={styles.statsTitle}>Your City</Text>
          <Text style={styles.statsValue}>{city}</Text>
        </View>
        <View style={styles.statsDivider} />
        <View>
          <Text style={styles.statsTitle}>Available Doctors</Text>
          <Text style={styles.statsValue}>{count}</Text>
        </View>
      </View>

      {/* Doctors List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        
        {doctors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="medical-services" size={80} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Doctors Found</Text>
            <Text style={styles.emptySubtitle}>
              There are no doctors available in {city} at the moment.
            </Text>
          </View>
        ) : (
          doctors.map((doctor, index) => (
            <View key={index} style={styles.doctorCard}>
              {/* Card Header with Avatar */}
              <View style={styles.cardHeader}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {doctor.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.doctorName}>Dr. {doctor.name}</Text>
                  <View style={styles.degreeBadge}>
                    <MaterialIcons name="school" size={14} color="#7C3AED" />
                    <Text style={styles.degreeText}>{doctor.degree.toUpperCase()}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => handleBookAppointment(doctor)}>
                  <MaterialIcons name="event" size={18} color="#FFFFFF" />
                  <Text style={styles.bookButtonText}>Book</Text>
                </TouchableOpacity>
              </View>

              {/* Card Body - Contact Details */}
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="email" size={18} color="#64748B" />
                  <Text style={styles.infoLabel}>Email:</Text>
                  <TouchableOpacity onPress={() => handleEmailDoctor(doctor.email)}>
                    <Text style={styles.infoValue}>{doctor.email}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={18} color="#64748B" />
                  <Text style={styles.infoLabel}>Mobile:</Text>
                  <TouchableOpacity onPress={() => handleCallDoctor(doctor.mobile)}>
                    <Text style={[styles.infoValue, styles.phoneText]}>{doctor.mobile}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                  <MaterialIcons name="location-on" size={18} color="#64748B" />
                  <Text style={styles.infoLabel}>Address:</Text>
                  <Text style={styles.infoValue}>{doctor.address}</Text>
                </View>
              </View>

              {/* Card Footer - Action Buttons */}
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCallDoctor(doctor.mobile)}>
                  <MaterialIcons name="call" size={20} color="#10B981" />
                  <Text style={[styles.actionText, { color: '#10B981' }]}>Call</Text>
                </TouchableOpacity>

                <View style={styles.actionDivider} />

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEmailDoctor(doctor.email)}>
                  <MaterialIcons name="email" size={20} color="#3B82F6" />
                  <Text style={[styles.actionText, { color: '#3B82F6' }]}>Email</Text>
                </TouchableOpacity>

                <View style={styles.actionDivider} />

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleBookAppointment(doctor)}>
                  <MaterialIcons name="event" size={20} color="#7C3AED" />
                  <Text style={[styles.actionText, { color: '#7C3AED' }]}>Appointment</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  countBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7C3AED',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  doctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  degreeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  degreeText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '500',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginLeft: 8,
    width: 60,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    flex: 1,
    marginLeft: 4,
  },
  phoneText: {
    color: '#10B981',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
});