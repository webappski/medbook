<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useAppointmentsStore } from '@/stores/appointments.store';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  XMarkIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline';
import type { Appointment } from '@/types/medical.types';

const auth = useAuthStore();
const appointments = useAppointmentsStore();

const showCancelModal = ref(false);
const cancellingAppointment = ref<Appointment | null>(null);
const cancelReason = ref('');
const isCancelling = ref(false);

// Details modal
const showDetailsModal = ref(false);
const selectedAppointment = ref<Appointment | null>(null);

function openDetails(apt: Appointment) {
  selectedAppointment.value = apt;
  showDetailsModal.value = true;
}

onMounted(async () => {
  await appointments.fetchAppointments();
});

const upcomingList = computed(() => appointments.upcomingAppointments);
const nextAppointment = computed(() => appointments.nextAppointment);
const pagination = computed(() => appointments.pagination);

async function goToPage(page: number) {
  appointments.setPage(page);
  await appointments.fetchAppointments();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300',
    confirmed: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    completed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
    cancelled: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
    no_show: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300',
  };
  return colors[status] || colors.pending;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  };
  return labels[status] || status;
}

function getDaysUntil(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `In ${diff} days`;
  return `In ${Math.ceil(diff / 7)} weeks`;
}

function formatCreatedAt(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Convert camelCase field key to human-readable label */
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/** Format field value for display (handles arrays, booleans, etc.) */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function openCancelModal(apt: Appointment) {
  cancellingAppointment.value = apt;
  cancelReason.value = '';
  showCancelModal.value = true;
}

async function confirmCancel() {
  if (!cancellingAppointment.value || !auth.user?.id) return;

  isCancelling.value = true;
  try {
    await appointments.cancelAppointment(
      cancellingAppointment.value.id,
      cancelReason.value,
      auth.user.id
    );
    showCancelModal.value = false;
    cancellingAppointment.value = null;
  } catch (error) {
    console.error('Failed to cancel appointment:', error);
  } finally {
    isCancelling.value = false;
  }
}
</script>

<template>
  <div class="space-y-8 animate-fade-in">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">My Appointments</h1>
        <p class="text-neutral-600 dark:text-neutral-400 mt-1">
          Manage your upcoming visits
        </p>
      </div>
      <RouterLink
        to="/doctors"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-xl font-semibold transition-colors"
      >
        <PlusIcon class="w-5 h-5" />
        <span>Book New</span>
      </RouterLink>
    </div>

    <!-- Loading -->
    <div v-if="appointments.loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 animate-pulse">
        <div class="flex gap-4">
          <div class="w-16 h-16 bg-neutral-200 dark:bg-neutral-700 rounded-2xl"></div>
          <div class="flex-1 space-y-3">
            <div class="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-1/3"></div>
            <div class="h-4 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-1/2"></div>
            <div class="h-4 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-1/4"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Next Appointment Highlight -->
    <div
      v-else-if="nextAppointment"
      class="relative overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl p-7 text-white shadow-glow-primary"
    >
      <!-- Decorative elements -->
      <div class="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-primary-400/20 rounded-full translate-y-1/2 -translate-x-1/4"></div>

      <div class="relative z-10">
        <div class="flex items-center gap-2 text-primary-200 text-sm mb-3">
          <SparklesIcon class="w-4 h-4" />
          <span class="font-semibold">{{ getDaysUntil(nextAppointment.slotDate) }}</span>
        </div>
        <h2 class="text-2xl font-bold mb-1">
          {{ nextAppointment.doctor?.name || 'Doctor' }}
        </h2>
        <p class="text-primary-200 font-medium mb-5">{{ nextAppointment.specialty }}</p>
        <div class="flex flex-wrap gap-5 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <CalendarIcon class="w-4 h-4" />
            </div>
            <span>{{ formatDate(nextAppointment.slotDate) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <ClockIcon class="w-4 h-4" />
            </div>
            <span>{{ formatTime(nextAppointment.slotTime) }}</span>
          </div>
          <div v-if="nextAppointment.doctor?.location" class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <MapPinIcon class="w-4 h-4" />
            </div>
            <span>{{ nextAppointment.doctor.location }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Upcoming Appointments -->
    <div v-if="!appointments.loading">
      <h2 class="text-lg font-bold text-neutral-900 dark:text-white mb-4">
        Upcoming Appointments ({{ upcomingList.length }})
      </h2>

      <!-- Empty State -->
      <div
        v-if="upcomingList.length === 0"
        class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-10 text-center"
      >
        <div class="w-18 h-18 bg-neutral-100 dark:bg-neutral-700 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <CalendarIcon class="w-9 h-9 text-neutral-400" />
        </div>
        <h3 class="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          No upcoming appointments
        </h3>
        <p class="text-neutral-600 dark:text-neutral-400 mb-6">
          Book your first appointment to get started
        </p>
        <RouterLink to="/doctors" class="btn bg-primary-600 text-white hover:bg-primary-700">
          <PlusIcon class="w-5 h-5" />
          <span>Find a Doctor</span>
        </RouterLink>
      </div>

      <!-- Appointments List -->
      <div v-else class="space-y-4">
        <div
          v-for="apt in upcomingList"
          :key="apt.id"

          class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5 hover:shadow-soft-md hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300"
        >
          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Doctor Avatar -->
            <div class="flex-shrink-0">
              <div
                v-if="apt.doctor?.imageUrl"
                class="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-neutral-200 dark:ring-neutral-700"
              >
                <img
                  :src="apt.doctor.imageUrl"
                  :alt="apt.doctor.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div
                v-else
                class="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center"
              >
                <span class="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {{ apt.doctor?.name?.charAt(0) || 'D' }}
                </span>
              </div>
            </div>

            <!-- Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="font-bold text-neutral-900 dark:text-white">
                    {{ apt.doctor?.name || 'Doctor' }}
                  </h3>
                  <p class="text-sm text-primary-600 dark:text-primary-400 font-medium">
                    {{ apt.specialty }}
                  </p>
                </div>
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold', getStatusColor(apt.status)]">
                  {{ getStatusLabel(apt.status) }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-4 mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                <div class="flex items-center gap-1.5">
                  <CalendarIcon class="w-4 h-4 text-neutral-400" />
                  <span>{{ formatDate(apt.slotDate) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <ClockIcon class="w-4 h-4 text-neutral-400" />
                  <span>{{ formatTime(apt.slotTime) }}</span>
                </div>
                <span class="text-primary-600 dark:text-primary-400 font-semibold">
                  {{ getDaysUntil(apt.slotDate) }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span v-if="apt.patientFirstName || apt.patientLastName">
                  {{ apt.patientFirstName }} {{ apt.patientLastName }}
                </span>
                <span v-if="apt.reason" class="truncate max-w-xs">
                  · {{ apt.reason }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-3 mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                <span v-if="apt.createdAt">Booked {{ formatCreatedAt(apt.createdAt) }}</span>
                <span v-if="apt.confirmationNumber">· #{{ apt.confirmationNumber }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex sm:flex-col gap-2 sm:items-end justify-end">
              <button
                @click="openDetails(apt)"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors"
              >
                <span>Details</span>
                <ChevronRightIcon class="w-4 h-4" />
              </button>
              <button
                v-if="apt.status === 'pending' || apt.status === 'confirmed'"
                @click="openCancelModal(apt)"
                class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-xl transition-colors"
              >
                <XMarkIcon class="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-between mt-6 px-1">
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          Showing {{ (pagination.page - 1) * pagination.limit + 1 }}–{{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }}
        </p>
        <div class="flex items-center gap-2">
          <button
            @click="goToPage(pagination.page - 1)"
            :disabled="pagination.page === 1"
            class="px-3 py-1.5 text-sm font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span class="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            {{ pagination.page }} / {{ pagination.totalPages }}
          </span>
          <button
            @click="goToPage(pagination.page + 1)"
            :disabled="pagination.page === pagination.totalPages"
            class="px-3 py-1.5 text-sm font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
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
          class="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          @click.self="showDetailsModal = false"
        >
          <div class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-7 max-w-lg w-full shadow-soft-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-xl font-bold text-neutral-900 dark:text-white">Appointment Details</h3>
              <button
                @click="showDetailsModal = false"
                class="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-colors"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <!-- Status & Confirmation -->
              <div class="flex items-center justify-between p-4 bg-neutral-100 dark:bg-neutral-900 rounded-2xl">
                <div>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Confirmation #</p>
                  <p class="font-mono font-semibold text-neutral-900 dark:text-white">{{ selectedAppointment.confirmationNumber || '—' }}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Booked {{ formatCreatedAt(selectedAppointment.createdAt) }}
                  </p>
                </div>
                <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold', getStatusColor(selectedAppointment.status)]">
                  {{ getStatusLabel(selectedAppointment.status) }}
                </span>
              </div>

              <!-- Appointment -->
              <div class="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl space-y-3">
                <h4 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Appointment</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Doctor</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.doctor?.name || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Specialty</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.specialty || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Date</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ formatDate(selectedAppointment.slotDate) }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Time</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ formatTime(selectedAppointment.slotTime) }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Reason for Visit</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.reason || '—' }}</p>
                  </div>
                  <div v-if="selectedAppointment.notes" class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Notes</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.notes }}</p>
                  </div>
                </div>
              </div>

              <!-- Patient Information -->
              <div class="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl space-y-3">
                <h4 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Patient Information</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">First Name</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.patientFirstName || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Last Name</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.patientLastName || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Email</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.patientEmail || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Phone</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.patientPhone || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Date of Birth</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.dateOfBirth || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Gender</p>
                    <p class="font-medium text-neutral-900 dark:text-white capitalize">{{ selectedAppointment.gender || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Address</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.address || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Emergency Contact</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.emergencyContact || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Emergency Phone</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.emergencyPhone || '—' }}</p>
                  </div>
                </div>
              </div>

              <!-- Medical History -->
              <div class="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl space-y-3">
                <h4 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Medical History</h4>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Blood Type</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.medicalHistorySnapshot?.bloodType || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Smoking</p>
                    <p class="font-medium text-neutral-900 dark:text-white capitalize">{{ selectedAppointment.medicalHistorySnapshot?.smokingStatus || '—' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Alcohol</p>
                    <p class="font-medium text-neutral-900 dark:text-white capitalize">{{ selectedAppointment.medicalHistorySnapshot?.alcoholConsumption || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Allergies</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.medicalHistorySnapshot?.allergies || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Chronic Conditions</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.medicalHistorySnapshot?.chronicConditions || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Current Medications</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.medicalHistorySnapshot?.currentMedications || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Previous Surgeries</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.medicalHistorySnapshot?.previousSurgeries || '—' }}</p>
                  </div>
                  <div class="col-span-2">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">Family History</p>
                    <p class="font-medium text-neutral-900 dark:text-white">{{ selectedAppointment.medicalHistorySnapshot?.familyHistory || '—' }}</p>
                  </div>
                </div>
              </div>

              <!-- Specialty-Specific Data -->
              <div v-if="selectedAppointment.specialtyFormData && Object.keys(selectedAppointment.specialtyFormData).length > 0" class="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl space-y-3">
                <h4 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Specialty Details</h4>
                <div class="grid grid-cols-2 gap-3">
                  <template v-for="(value, key) in selectedAppointment.specialtyFormData" :key="key">
                    <div :class="typeof value === 'string' && value.length > 20 ? 'col-span-2' : ''">
                      <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ formatFieldLabel(String(key)) }}</p>
                      <p class="font-medium text-neutral-900 dark:text-white">{{ formatFieldValue(value) }}</p>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex gap-3 pt-2">
                <button
                  @click="showDetailsModal = false"
                  class="btn border-2 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 flex-1"
                >
                  Close
                </button>
                <button
                  v-if="selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed'"
                  @click="showDetailsModal = false; openCancelModal(selectedAppointment)"
                  class="flex-1 px-6 py-3.5 bg-error-500 hover:bg-error-600 text-white font-semibold rounded-2xl transition-colors"
                >
                  Cancel Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Cancel Modal -->
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
          v-if="showCancelModal"
          class="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          @click.self="showCancelModal = false"
        >
          <div class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-7 max-w-md w-full shadow-soft-xl">
            <h3 class="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Cancel Appointment
            </h3>
            <p class="text-neutral-600 dark:text-neutral-400 mb-5">
              Are you sure you want to cancel your appointment with
              <span class="font-semibold">{{ cancellingAppointment?.doctor?.name }}</span> on
              {{ cancellingAppointment?.slotDate ? formatDate(cancellingAppointment.slotDate) : '' }}?
            </p>

            <div class="mb-6">
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Reason for cancellation (optional)
              </label>
              <textarea
                v-model="cancelReason"
                rows="3"
                class="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Let us know why you're cancelling..."
              ></textarea>
            </div>

            <div class="flex gap-3">
              <button
                @click="showCancelModal = false"
                :disabled="isCancelling"
                class="btn border-2 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 flex-1"
              >
                Keep Appointment
              </button>
              <button
                @click="confirmCancel"
                :disabled="isCancelling"
                class="flex-1 px-6 py-3.5 bg-error-500 hover:bg-error-600 disabled:bg-error-300 dark:disabled:bg-error-800 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  v-if="isCancelling"
                  class="animate-spin w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{{ isCancelling ? 'Cancelling...' : 'Yes, Cancel' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
