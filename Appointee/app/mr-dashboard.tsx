import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function MRDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const token = await AsyncStorage.getItem('mr_token');

      if (!token) {
        router.replace('/mr-login');
        return;
      }
    } catch (error) {
      router.replace('/mr-login');
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('mr_token');
            router.replace('/mr-login');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.mrName}>Medical Representative</Text>
          <Text style={styles.companyText}>Dashboard Panel</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialIcons
            name="logout"
            size={22}
            color="#EF4444"
          />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.dashboardTitle}>MR Dashboard</Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.card}>
            <MaterialIcons
              name="people"
              size={30}
              color="#7C3AED"
            />
            <Text style={styles.cardTitle}>Doctors</Text>
            <Text style={styles.cardValue}>0</Text>
          </View>

          <View style={styles.card}>
            <MaterialIcons
              name="event"
              size={30}
              color="#10B981"
            />
            <Text style={styles.cardTitle}>Meetings</Text>
            <Text style={styles.cardValue}>0</Text>
          </View>

          <View style={styles.card}>
            <MaterialIcons
              name="assignment"
              size={30}
              color="#F59E0B"
            />
            <Text style={styles.cardTitle}>Reports</Text>
            <Text style={styles.cardValue}>0</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialIcons
              name="add-circle"
              size={28}
              color="#7C3AED"
            />
            <Text style={styles.actionText}>New Visit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MaterialIcons
              name="calendar-today"
              size={28}
              color="#7C3AED"
            />
            <Text style={styles.actionText}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MaterialIcons
              name="description"
              size={28}
              color="#7C3AED"
            />
            <Text style={styles.actionText}>Reports</Text>
          </TouchableOpacity>
        </View>

        {/* Empty Tasks */}
        <Text style={styles.sectionTitle}>Upcoming Tasks</Text>

        <View style={styles.tasksContainer}>
          <Text style={styles.noTasksText}>
            No upcoming tasks
          </Text>
        </View>
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
  },

  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: '#64748B',
  },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  welcomeText: {
    fontSize: 13,
    color: '#64748B',
  },

  mrName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 2,
  },

  companyText: {
    fontSize: 12,
    color: '#7C3AED',
    marginTop: 2,
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  logoutText: {
    marginLeft: 6,
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },

  content: {
    padding: 20,
  },

  dashboardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 5,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
  },

  cardTitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },

  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 14,
  },

  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 5,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
  },

  actionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#1E293B',
    textAlign: 'center',
  },

  tasksContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 40,
  },

  noTasksText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});