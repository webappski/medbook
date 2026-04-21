import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Appointment, AppointmentFilters, AppointmentStatus, Doctor } from '@/types/medical.types';

interface CreateAppointmentData {
  doctorId: string;
  slotId?: string;
  slotDate: string;
  slotTime: string;
  specialty: string;
  reason?: string;
  notes?: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  patientPhone: string;
  medicalHistorySnapshot?: Record<string, unknown>;
  specialtyFormData?: Record<string, unknown>;
}

function mapDbAppointment(data: Record<string, unknown>, doctor?: Doctor): Appointment {
  return {
    id: data.id as string,
    patientId: data.patient_id as string,
    doctorId: data.doctor_id as string,
    slotId: data.slot_id as string | null,
    slotDate: data.slot_date as string,
    slotTime: (data.slot_start_time || data.slot_time) as string,
    specialty: data.specialty as string,
    status: data.status as AppointmentStatus,
    reason: data.reason as string | null,
    notes: data.notes as string | null,
    // Map from 'appointments' table column names
    patientFirstName: (data.first_name || data.patient_first_name) as string | null,
    patientLastName: (data.last_name || data.patient_last_name) as string | null,
    patientEmail: (data.email || data.patient_email) as string | null,
    patientPhone: (data.phone || data.patient_phone) as string | null,
    dateOfBirth: (data.date_of_birth || null) as string | null,
    gender: (data.gender || null) as string | null,
    address: (data.address || null) as string | null,
    emergencyContact: (data.emergency_contact || null) as string | null,
    emergencyPhone: (data.emergency_phone || null) as string | null,
    medicalHistorySnapshot: (data.medical_history || data.medical_history_snapshot || {}) as Record<string, unknown>,
    specialtyFormData: (data.specialty_form_data || {}) as Record<string, unknown>,
    cancelledAt: data.cancelled_at as string | null,
    cancelledBy: data.cancelled_by as string | null,
    cancellationReason: data.cancellation_reason as string | null,
    confirmationNumber: data.confirmation_number as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    doctor,
  };
}

export const useAppointmentsStore = defineStore('appointments', () => {
  // State
  const appointments = ref<Appointment[]>([]);
  const currentAppointment = ref<Appointment | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const filters = ref<AppointmentFilters>({
    status: null,
    doctorId: null,
    patientId: null,
    dateFrom: null,
    dateTo: null,
    search: '',
  });

  // Doctors cache for display
  const doctorsCache = ref<Map<string, Doctor>>(new Map());

  // Computed
  const upcomingAppointments = computed(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return appointments.value
      .filter((a) => {
        const aptDate = new Date(a.slotDate);
        return (
          ['pending', 'confirmed'].includes(a.status) &&
          aptDate >= now
        );
      });
  });

  const pastAppointments = computed(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return appointments.value
      .filter((a) => {
        const aptDate = new Date(a.slotDate);
        return (
          a.status === 'completed' ||
          a.status === 'cancelled' ||
          a.status === 'no_show' ||
          aptDate < now
        );
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.slotDate}T${a.slotTime}`);
        const dateB = new Date(`${b.slotDate}T${b.slotTime}`);
        return dateB.getTime() - dateA.getTime();
      });
  });

  const nextAppointment = computed(() => upcomingAppointments.value[0] || null);

  // Actions
  async function fetchDoctors(doctorIds: string[]) {
    const uncachedIds = doctorIds.filter((id) => !doctorsCache.value.has(id));
    if (uncachedIds.length === 0) return;

    try {
      const response = await fetch(`/api/doctors`);
      const data = await response.json();

      if (data.doctors) {
        for (const doctor of data.doctors) {
          doctorsCache.value.set(doctor.id, doctor);
        }
      }
    } catch (e) {
      console.error('Error fetching doctors:', e);
    }
  }

  async function fetchAppointments(patientIdOrEmail?: string) {
    loading.value = true;
    error.value = null;

    try {
      let query = supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply patient filter (for cabinet) - filter by email for widget bookings
      if (patientIdOrEmail) {
        // Check if it's an email or UUID
        if (patientIdOrEmail.includes('@')) {
          query = query.eq('email', patientIdOrEmail);
        } else {
          // Try both patient_id and email (for flexibility)
          query = query.or(`patient_id.eq.${patientIdOrEmail},email.eq.${patientIdOrEmail}`);
        }
      }

      // Apply other filters
      if (filters.value.status) {
        query = query.eq('status', filters.value.status);
      }
      if (filters.value.doctorId) {
        query = query.eq('doctor_id', filters.value.doctorId);
      }
      if (filters.value.dateFrom) {
        query = query.gte('slot_date', filters.value.dateFrom);
      }
      if (filters.value.dateTo) {
        query = query.lte('slot_date', filters.value.dateTo);
      }

      // Pagination
      const from = (pagination.value.page - 1) * pagination.value.limit;
      const to = from + pagination.value.limit - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      // Fetch doctors for display
      const doctorIds = [...new Set((data || []).map((a) => a.doctor_id))];
      await fetchDoctors(doctorIds);

      // Map appointments with doctor data
      appointments.value = (data || []).map((apt) =>
        mapDbAppointment(apt, doctorsCache.value.get(apt.doctor_id))
      );

      pagination.value = {
        ...pagination.value,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pagination.value.limit),
      };
    } catch (e) {
      error.value = (e as Error).message;
      console.error('Error fetching appointments:', e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchAppointment(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Fetch doctor
      await fetchDoctors([data.doctor_id]);

      currentAppointment.value = mapDbAppointment(
        data,
        doctorsCache.value.get(data.doctor_id)
      );

      return currentAppointment.value;
    } catch (e) {
      error.value = (e as Error).message;
      console.error('Error fetching appointment:', e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createAppointment(patientId: string, data: CreateAppointmentData) {
    loading.value = true;
    error.value = null;

    try {
      const { data: newAppointment, error: createError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          doctor_id: data.doctorId,
          slot_id: data.slotId,
          slot_date: data.slotDate,
          slot_time: data.slotTime,
          specialty: data.specialty,
          reason: data.reason,
          notes: data.notes,
          patient_first_name: data.patientFirstName,
          patient_last_name: data.patientLastName,
          patient_email: data.patientEmail,
          patient_phone: data.patientPhone,
          medical_history_snapshot: data.medicalHistorySnapshot || {},
          specialty_form_data: data.specialtyFormData || {},
          status: 'pending',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Fetch doctor and add to list
      await fetchDoctors([data.doctorId]);
      const appointment = mapDbAppointment(
        newAppointment,
        doctorsCache.value.get(data.doctorId)
      );

      appointments.value.unshift(appointment);

      return appointment;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function cancelAppointment(id: string, reason: string, userId: string) {
    loading.value = true;
    error.value = null;

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: reason,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      const index = appointments.value.findIndex((a) => a.id === id);
      if (index !== -1) {
        appointments.value[index] = {
          ...appointments.value[index],
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          cancelledBy: userId,
          cancellationReason: reason,
        };
      }

      if (currentAppointment.value?.id === id) {
        currentAppointment.value = {
          ...currentAppointment.value,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          cancelledBy: userId,
          cancellationReason: reason,
        };
      }
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    loading.value = true;
    error.value = null;

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      const index = appointments.value.findIndex((a) => a.id === id);
      if (index !== -1) {
        appointments.value[index] = {
          ...appointments.value[index],
          status,
        };
      }

      if (currentAppointment.value?.id === id) {
        currentAppointment.value = {
          ...currentAppointment.value,
          status,
        };
      }
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function setFilters(newFilters: Partial<AppointmentFilters>) {
    filters.value = { ...filters.value, ...newFilters };
    pagination.value.page = 1;
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function reset() {
    appointments.value = [];
    currentAppointment.value = null;
    filters.value = {
      status: null,
      doctorId: null,
      patientId: null,
      dateFrom: null,
      dateTo: null,
      search: '',
    };
    pagination.value = { page: 1, limit: 10, total: 0, totalPages: 0 };
    error.value = null;
  }

  function clearError() {
    error.value = null;
  }

  return {
    // State
    appointments,
    currentAppointment,
    loading,
    error,
    pagination,
    filters,
    doctorsCache,
    // Computed
    upcomingAppointments,
    pastAppointments,
    nextAppointment,
    // Actions
    fetchAppointments,
    fetchAppointment,
    createAppointment,
    cancelAppointment,
    updateStatus,
    setFilters,
    setPage,
    reset,
    clearError,
  };
});
