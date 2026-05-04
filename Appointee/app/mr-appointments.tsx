import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'http://localhost:8000/api';

interface Doctor {
  _id: string;
  dr_name: string;
  dr_degree: string;
  dr_email: string;
  dr_mobile_number: string;
  dr_city: string;
  dr_address: string;
}

interface Slot {
  _id: string;
  doctor_id: string;
  day: string;
  timeslot: string;
}

interface Appointment {
  _id: string;
  doctor_id: Doctor;
  slot_id: Slot;
  mr_id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  status: 'live' | 'past';
  __v: number;
}

export default function MRAppointments() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'live' | 'past'>('all');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const formatDateToIST = (utcDate: string) => {
    const date = new Date(utcDate);
    // Convert to IST (UTC + 5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    
    // Format: "Monday, 15 May 2024"
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return istDate.toLocaleDateString('en-IN', options);
  };

  const formatTimeIST = (utcDate: string) => {
    const date = new Date(utcDate);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    
    // Format: "03:30 PM"
    return istDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const fetchAppointments = async () => {
    console.log('\n========== [FETCH APPOINTMENTS] START ==========');
    
    try {
      const token = await AsyncStorage.getItem('mr_token');
      console.log('[FETCH APPOINTMENTS] Token exists:', token ? 'YES' : 'NO');
      
      if (!token) {
        Alert.alert('Error', 'Please login again');
        router.replace('/mr-login');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/mr/get-mr-appointments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      console.log('[FETCH APPOINTMENTS] Response Status:', response.status);
      console.log('[FETCH APPOINTMENTS] Response Data:', JSON.stringify(response.data, null, 2));
      
      if (response.data.success) {
        setAppointments(response.data.data);
        console.log('[FETCH APPOINTMENTS] Total appointments:', response.data.data.length);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to fetch appointments');
      }
    } catch (error: any) {
      console.error('[FETCH APPOINTMENTS] Error:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        router.replace('/mr-login');
      } else {
        Alert.alert('Error', 'Failed to load appointments');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('========== [FETCH APPOINTMENTS] END ==========\n');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAppointments();
  }, []);

  // Updated: Back button redirects to mr-dashboard
  const handleBackPress = () => {
    router.replace('/mr-dashboard');
  };

  const getFilteredAppointments = () => {
    if (selectedFilter === 'all') return appointments;
    return appointments.filter(app => app.status === selectedFilter);
  };

  const getStatusColor = (status: string) => {
    return status === 'live' ? '#10B981' : '#94A3B8';
  };

  const getStatusIcon = (status: string) => {
    return status === 'live' ? 'circle' : 'check-circle';
  };

  const getStatusText = (status: string) => {
    return status === 'live' ? 'Upcoming' : 'Completed';
  };

  const filteredAppointments = getFilteredAppointments();
  const liveCount = appointments.filter(a => a.status === 'live').length;
  const pastCount = appointments.filter(a => a.status === 'past').length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#A855F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Appointments</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('all')}>
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All ({appointments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'live' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('live')}>
          <Text style={[styles.filterText, selectedFilter === 'live' && styles.filterTextActive]}>
            Upcoming ({liveCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'past' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('past')}>
          <Text style={[styles.filterText, selectedFilter === 'past' && styles.filterTextActive]}>
            Completed ({pastCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />
        }>
        
        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="event-busy" size={64} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No Appointments</Text>
            <Text style={styles.emptyDescription}>
              {selectedFilter === 'all' 
                ? "You don't have any appointments yet."
                : selectedFilter === 'live'
                ? "You don't have any upcoming appointments."
                : "You don't have any completed appointments."}
            </Text>
            <TouchableOpacity style={styles.bookButton} onPress={() => router.push('/mr-dashboard')}>
              <Text style={styles.bookButtonText}>Book an Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredAppointments.map((appointment, index) => (
            <View key={appointment._id} style={styles.appointmentCard}>
              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) + '15' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(appointment.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                  {getStatusText(appointment.status)}
                </Text>
              </View>

              {/* Doctor Info */}
              <View style={styles.doctorSection}>
                <View style={styles.doctorAvatar}>
                  <Text style={styles.avatarText}>
                    {appointment.doctor_id.dr_name?.charAt(0).toUpperCase() || 'D'}
                  </Text>
                </View>
                <View style={styles.doctorInfo}>
                  <Text style={styles.doctorName}>
                    Dr. {appointment.doctor_id.dr_name}
                  </Text>
                  <Text style={styles.doctorDegree}>
                    {appointment.doctor_id.dr_degree}
                  </Text>
                </View>
              </View>

              {/* Appointment Details */}
              <View style={styles.detailsSection}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="calendar-today" size={18} color="#6366F1" />
                  <Text style={styles.detailText}>
                    {formatDateToIST(appointment.date)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="access-time" size={18} color="#6366F1" />
                  <Text style={styles.detailText}>
                    {appointment.slot_id.timeslot}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="location-on" size={18} color="#6366F1" />
                  <Text style={styles.detailText}>
                    {appointment.doctor_id.dr_address}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="phone" size={18} color="#6366F1" />
                  <Text style={styles.detailText}>
                    {appointment.doctor_id.dr_mobile_number}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              {appointment.status === 'live' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.callButton}>
                    <MaterialIcons name="call" size={18} color="#FFFFFF" />
                    <Text style={styles.callButtonText}>Call Doctor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rescheduleButton}>
                    <MaterialIcons name="refresh" size={18} color="#6366F1" />
                    <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Booking Date */}
              <View style={styles.footer}>
                <MaterialIcons name="info-outline" size={12} color="#94A3B8" />
                <Text style={styles.footerText}>
                  Booked on {formatDateToIST(appointment.createdAt)}
                </Text>
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
  headerGradient: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#6366F1',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  doctorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  doctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  doctorDegree: {
    fontSize: 13,
    color: '#6366F1',
  },
  detailsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rescheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    paddingVertical: 12,
  },
  rescheduleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  bookButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});