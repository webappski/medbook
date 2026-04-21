<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  EyeIcon,
} from '@heroicons/vue/24/outline';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId: string;
  specialty: string;
  slotDate: string;
  slotTime: string;
  status: string;
  confirmationNumber: string;
  notes: string;
  createdAt: string;
}

const appointments = ref<Appointment[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<string | null>(null);
const dateFilter = ref<string | null>(null);
const currentPage = ref(1);
const totalCount = ref(0);
const pageSize = 10;

const selectedAppointment = ref<Appointment | null>(null);
const showDetailsModal = ref(false);
const isUpdating = ref(false);

onMounted(() => {
  fetchAppointments();
});

watch([searchQuery, statusFilter, dateFilter], () => {
  currentPage.value = 1;
  fetchAppointments();
});

watch(currentPage, () => {
  fetchAppointments();
});

async function fetchAppointments() {
  loading.value = true;
  try {
    // Read from 'appointments' table (where widget bookings are stored)
    let query = supabase
      .from('appointments')
      .select('*', { count: 'exact' });

    if (statusFilter.value) {
      query = query.eq('status', statusFilter.value);
    }

    if (dateFilter.value) {
      query = query.eq('slot_date', dateFilter.value);
    }

    if (searchQuery.value) {
      query = query.or(`first_name.ilike.%${searchQuery.value}%,last_name.ilike.%${searchQuery.value}%,email.ilike.%${searchQuery.value}%,confirmation_number.ilike.%${searchQuery.value}%`);
    }

    const from = (currentPage.value - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('slot_date', { ascending: false })
      .order('slot_start_time', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Map fields from 'appointments' table (different column names)
    appointments.value = (data || []).map(apt => ({
      id: apt.id,
      patientId: apt.patient_id,
      patientName: `${apt.first_name || ''} ${apt.last_name || ''}`.trim() || 'Unknown',
      patientEmail: apt.email || '',
      patientPhone: apt.phone || '',
      doctorId: apt.doctor_id,
      specialty: apt.specialty,
      slotDate: apt.slot_date,
      slotTime: apt.slot_start_time,
      status: apt.status,
      confirmationNumber: apt.confirmation_number || '',
      notes: apt.notes || '',
      createdAt: apt.created_at,
    }));

    totalCount.value = count || 0;
  } catch (e) {
    console.error('Error fetching appointments:', e);
  } finally {
    loading.value = false;
  }
}

const totalPages = computed(() => Math.ceil(totalCount.value / pageSize));

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getStatusConfig(status: string) {
  const configs: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Pending' },
    confirmed: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Confirmed' },
    completed: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Completed' },
    cancelled: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Cancelled' },
    no_show: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'No Show' },
  };
  return configs[status] || configs.pending;
}

function openDetails(apt: Appointment) {
  selectedAppointment.value = apt;
  showDetailsModal.value = true;
}

async function updateStatus(apt: Appointment, newStatus: string) {
  isUpdating.value = true;
  try {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', apt.id);

    if (error) throw error;

    apt.status = newStatus;
    if (selectedAppointment.value?.id === apt.id) {
      selectedAppointment.value.status = newStatus;
    }
  } catch (e) {
    console.error('Error updating status:', e);
  } finally {
    isUpdating.value = false;
  }
}

function clearFilters() {
  searchQuery.value = '';
  statusFilter.value = null;
  dateFilter.value = null;
}
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-white">Appointments</h1>
        <p class="text-gray-400 mt-1">
          Manage and track all appointments
        </p>
      </div>
      <div class="text-sm text-gray-400">
        {{ totalCount }} total appointments
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-700/50">
      <div class="flex flex-col lg:flex-row gap-4">
        <!-- Search -->
        <div class="flex-1 relative">
          <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, email, or confirmation..."
            class="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>

        <!-- Status Filter -->
        <div class="flex items-center gap-2">
          <FunnelIcon class="w-5 h-5 text-gray-500" />
          <select
            v-model="statusFilter"
            class="px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option :value="null">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>

        <!-- Date Filter -->
        <div class="flex items-center gap-2">
          <CalendarIcon class="w-5 h-5 text-gray-500" />
          <input
            v-model="dateFilter"
            type="date"
            class="px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <!-- Clear Filters -->
        <button
          v-if="searchQuery || statusFilter || dateFilter"
          @click="clearFilters"
          class="px-4 py-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="p-8">
        <div class="space-y-4">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4 animate-pulse">
            <div class="w-10 h-10 bg-gray-700 rounded-full"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-700 rounded w-1/4"></div>
              <div class="h-3 bg-gray-700 rounded w-1/3"></div>
            </div>
            <div class="h-6 bg-gray-700 rounded w-20"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="appointments.length === 0" class="p-12 text-center">
        <CalendarIcon class="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-white mb-2">No appointments found</h3>
        <p class="text-gray-400">
          {{ searchQuery || statusFilter || dateFilter ? 'Try adjusting your filters' : 'No appointments have been booked yet' }}
        </p>
      </div>

      <!-- Table Content -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-700">
              <th class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Patient</th>
              <th class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Specialty</th>
              <th class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date & Time</th>
              <th class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/50">
            <tr
              v-for="apt in appointments"
              :key="apt.id"
              class="hover:bg-gray-700/30 transition-colors"
            >
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                    <span class="text-sm font-medium text-white">{{ apt.patientName.charAt(0) }}</span>
                  </div>
                  <div>
                    <p class="font-medium text-white">{{ apt.patientName }}</p>
                    <p class="text-sm text-gray-400">{{ apt.patientEmail || apt.confirmationNumber }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="text-gray-300">{{ apt.specialty }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2 text-gray-300">
                  <CalendarIcon class="w-4 h-4 text-gray-500" />
                  <span>{{ formatDate(apt.slotDate) }}</span>
                </div>
                <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
                  <ClockIcon class="w-4 h-4 text-gray-500" />
                  <span>{{ formatTime(apt.slotTime) }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-3 py-1 rounded-full text-xs font-medium border', getStatusConfig(apt.status).color]">
                  {{ getStatusConfig(apt.status).label }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <button
                    @click="openDetails(apt)"
                    class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <EyeIcon class="w-4 h-4" />
                  </button>
                  <button
                    v-if="apt.status === 'pending'"
                    @click="updateStatus(apt, 'confirmed')"
                    :disabled="isUpdating"
                    class="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded-lg transition-colors"
                    title="Confirm"
                  >
                    <CheckIcon class="w-4 h-4" />
                  </button>
                  <button
                    v-if="apt.status === 'confirmed'"
                    @click="updateStatus(apt, 'completed')"
                    :disabled="isUpdating"
                    class="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg transition-colors"
                    title="Mark Complete"
                  >
                    <CheckIcon class="w-4 h-4" />
                  </button>
                  <button
                    v-if="apt.status !== 'cancelled' && apt.status !== 'completed'"
                    @click="updateStatus(apt, 'cancelled')"
                    :disabled="isUpdating"
                    class="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Cancel"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalCount > 0" class="flex items-center justify-between px-6 py-4 border-t border-gray-700">
        <p class="text-sm text-gray-400">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalCount) }} of {{ totalCount }}
        </p>
        <div class="flex items-center gap-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ChevronLeftIcon class="w-5 h-5" />
          </button>
          <span class="text-sm text-gray-400">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <ChevronRightIcon class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDetailsModal && selectedAppointment"
          class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          @click.self="showDetailsModal = false"
        >
          <div class="bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-xl border border-gray-700">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-xl font-semibold text-white">Appointment Details</h3>
              <button
                @click="showDetailsModal = false"
                class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <!-- Status -->
              <div class="flex items-center justify-between p-4 bg-gray-700/50 rounded-xl">
                <span class="text-gray-400">Status</span>
                <span :class="['px-3 py-1 rounded-full text-xs font-medium border', getStatusConfig(selectedAppointment.status).color]">
                  {{ getStatusConfig(selectedAppointment.status).label }}
                </span>
              </div>

              <!-- Confirmation -->
              <div class="flex items-center justify-between p-4 bg-gray-700/50 rounded-xl">
                <span class="text-gray-400">Confirmation #</span>
                <span class="text-white font-mono">{{ selectedAppointment.confirmationNumber || 'N/A' }}</span>
              </div>

              <!-- Patient Info -->
              <div class="p-4 bg-gray-700/50 rounded-xl space-y-3">
                <h4 class="text-sm font-medium text-gray-400 uppercase">Patient Information</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-gray-500">Name</p>
                    <p class="text-white">{{ selectedAppointment.patientName }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Email</p>
                    <p class="text-white">{{ selectedAppointment.patientEmail || 'N/A' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Phone</p>
                    <p class="text-white">{{ selectedAppointment.patientPhone || 'N/A' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Specialty</p>
                    <p class="text-white">{{ selectedAppointment.specialty }}</p>
                  </div>
                </div>
              </div>

              <!-- Schedule -->
              <div class="p-4 bg-gray-700/50 rounded-xl space-y-3">
                <h4 class="text-sm font-medium text-gray-400 uppercase">Schedule</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-gray-500">Date</p>
                    <p class="text-white">{{ formatDate(selectedAppointment.slotDate) }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-gray-500">Time</p>
                    <p class="text-white">{{ formatTime(selectedAppointment.slotTime) }}</p>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div v-if="selectedAppointment.notes" class="p-4 bg-gray-700/50 rounded-xl">
                <h4 class="text-sm font-medium text-gray-400 uppercase mb-2">Notes</h4>
                <p class="text-gray-300">{{ selectedAppointment.notes }}</p>
              </div>

              <!-- Quick Actions -->
              <div class="flex gap-3 pt-4">
                <button
                  v-if="selectedAppointment.status === 'pending'"
                  @click="updateStatus(selectedAppointment, 'confirmed')"
                  :disabled="isUpdating"
                  class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-medium rounded-xl transition-colors"
                >
                  Confirm Appointment
                </button>
                <button
                  v-if="selectedAppointment.status === 'confirmed'"
                  @click="updateStatus(selectedAppointment, 'completed')"
                  :disabled="isUpdating"
                  class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-xl transition-colors"
                >
                  Mark Complete
                </button>
                <button
                  v-if="selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed'"
                  @click="updateStatus(selectedAppointment, 'cancelled')"
                  :disabled="isUpdating"
                  class="flex-1 px-4 py-2.5 border border-red-500/50 text-red-400 hover:bg-red-500/20 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
