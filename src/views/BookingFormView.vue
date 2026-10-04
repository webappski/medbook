<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '@/stores/booking.store';
import { useApi } from '@/composables/useApi';
import { CheckIcon, ArrowLeftIcon, ArrowRightIcon, ExclamationCircleIcon } from '@heroicons/vue/24/outline';
import DoctorCard from '@/components/DoctorCard.vue';

import PatientInfoForm from '@/components/forms/PatientInfoForm.vue';
import MedicalHistoryForm from '@/components/forms/MedicalHistoryForm.vue';
import AppointmentTimeForm from '@/components/forms/AppointmentTimeForm.vue';

// Specialty forms
import CardiologyForm from '@/components/forms/specialty/CardiologyForm.vue';
import DermatologyForm from '@/components/forms/specialty/DermatologyForm.vue';
import OrthopedicForm from '@/components/forms/specialty/OrthopedicForm.vue';
import GeneralPractitionerForm from '@/components/forms/specialty/GeneralPractitionerForm.vue';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();
const { getDoctorById, createAppointment, loading: apiLoading, error: apiError } = useApi();

const loadingDoctor = ref(true);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const doctor = computed(() => bookingStore.selectedDoctor);
const currentStep = computed(() => bookingStore.currentStep);
const currentStepIndex = computed(() => bookingStore.currentStepIndex);

const specialtyFormComponents: Record<string, any> = {
  'cardiologist': CardiologyForm,
  'dermatologist': DermatologyForm,
  'general-practitioner': GeneralPractitionerForm,
  'orthopedic-surgeon': OrthopedicForm,
  'neurologist': GeneralPractitionerForm,
  'gastroenterologist': GeneralPractitionerForm,
  'pediatrician': GeneralPractitionerForm
};

const currentSpecialtyForm = computed(() => {
  if (!doctor.value) return null;
  return specialtyFormComponents[doctor.value.specialty] || GeneralPractitionerForm;
});

const stepTitles: Record<string, string> = {
  'patient-info': 'Personal Information',
  'medical-history': 'Medical History',
  'specialty-form': 'Symptoms & Concerns',
  'appointment-time': 'Appointment Details',
  'confirmation': 'Review & Confirm'
};

const stepDescriptions: Record<string, string> = {
  'patient-info': 'Tell us about yourself',
  'medical-history': 'Share your health background',
  'specialty-form': 'Describe your symptoms',
  'appointment-time': 'Pick your preferred time',
  'confirmation': 'Review and confirm your booking'
};

onMounted(async () => {
  const doctorId = route.params.doctorId as string;
  loadingDoctor.value = true;

  const foundDoctor = await getDoctorById(doctorId);

  if (!foundDoctor) {
    router.push('/doctors');
    return;
  }

  bookingStore.setDoctor(foundDoctor);
  loadingDoctor.value = false;
});

function handleNext() {
  bookingStore.nextStep();
}

function handleBack() {
  bookingStore.previousStep();
}

async function handleConfirm() {
  if (!doctor.value) return;

  isSubmitting.value = true;
  submitError.value = null;

  try {
    const result = await createAppointment({
      doctorId: doctor.value.id,
      slotDate: bookingStore.appointmentDate,
      slotStartTime: bookingStore.appointmentTime,
      specialty: doctor.value.specialty,
      patient: {
        firstName: bookingStore.patientInfo.firstName || '',
        lastName: bookingStore.patientInfo.lastName || '',
        email: bookingStore.patientInfo.email || '',
        phone: bookingStore.patientInfo.phone,
        dateOfBirth: bookingStore.patientInfo.dateOfBirth,
        gender: bookingStore.patientInfo.gender,
        address: bookingStore.patientInfo.address,
        emergencyContact: bookingStore.patientInfo.emergencyContact,
        emergencyPhone: bookingStore.patientInfo.emergencyPhone,
      },
      medicalHistory: bookingStore.medicalHistory,
      specialtyFormData: bookingStore.specialtyFormData,
      reason: bookingStore.appointmentReason,
      notes: bookingStore.appointmentNotes || undefined,
    });

    if (result) {
      // Store confirmation number for display
      console.log('Appointment created:', result);
      router.push('/confirmation');
    } else {
      submitError.value = apiError.value || 'Failed to create appointment. Please try again.';
    }
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'An unexpected error occurred';
  } finally {
    isSubmitting.value = false;
  }
}

function goToStep(index: number) {
  bookingStore.goToStep(bookingStore.bookingSteps[index]);
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 py-8 md:py-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Loading State -->
      <div v-if="!doctor" class="text-center py-32">
        <div class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-12 max-w-md mx-auto">
          <div class="w-10 h-10 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 rounded-full animate-spin mx-auto mb-6" />
          <p class="text-lg font-semibold text-neutral-700 dark:text-neutral-300">Loading...</p>
        </div>
      </div>

      <div v-else class="space-y-6">
        <!-- Doctor Info Card -->
        <DoctorCard
          :doctor="doctor"
          variant="compact"
          :show-book-button="false"
          :interactive="false"
        />

        <!-- Progress Section -->
        <div class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-5 sm:p-7">
          <!-- Step Info -->
          <div class="flex items-center justify-between mb-5">
            <div>
              <div class="text-sm font-bold text-primary-600 dark:text-primary-400 mb-1.5">
                Step {{ currentStepIndex + 1 }} of 5
              </div>
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white">
                {{ stepTitles[currentStep] }}
              </h2>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {{ stepDescriptions[currentStep] }}
              </p>
            </div>
            <div class="text-right hidden sm:block">
              <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {{ Math.round(((currentStepIndex + 1) / 5) * 100) }}%
              </div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full mb-7 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
              :style="{ width: `${((currentStepIndex + 1) / 5) * 100}%` }"
            />
          </div>

          <!-- Step Indicators -->
          <div class="flex justify-between relative">
            <!-- Connecting Line Background -->
            <div class="absolute top-5 left-0 right-0 h-0.5 bg-neutral-200 dark:bg-neutral-700" />
            <!-- Connecting Line Progress -->
            <div
              class="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
              :style="{ width: `${(currentStepIndex / 4) * 100}%` }"
            />

            <button
              v-for="(step, index) in bookingStore.bookingSteps"
              :key="step"
              @click="goToStep(index)"
              class="relative z-10 flex flex-col items-center group cursor-pointer"
            >
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300"
                :class="[
                  currentStepIndex > index
                    ? 'bg-success-500 text-white shadow-soft'
                    : currentStepIndex === index
                      ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow-primary'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'
                ]"
              >
                <CheckIcon v-if="currentStepIndex > index" class="w-5 h-5" />
                <span v-else>{{ index + 1 }}</span>
              </div>
              <span
                class="text-xs font-semibold mt-2 hidden md:block transition-colors"
                :class="[
                  currentStepIndex >= index
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-neutral-400'
                ]"
              >
                {{ stepTitles[step].split(' ')[0] }}
              </span>
            </button>
          </div>
        </div>

        <!-- Form Content -->
        <div class="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 sm:p-8">
          <Transition
            mode="out-in"
            enter-active-class="transition-all duration-300 ease-out"
            leave-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-4"
            leave-to-class="opacity-0 -translate-x-4"
          >
            <!-- Patient Info Step -->
            <PatientInfoForm
              v-if="currentStep === 'patient-info'"
              :key="'patient-info'"
              @submit="handleNext"
            />

            <!-- Medical History Step -->
            <MedicalHistoryForm
              v-else-if="currentStep === 'medical-history'"
              :key="'medical-history'"
              @submit="handleNext"
              @back="handleBack"
            />

            <!-- Specialty Form Step -->
            <component
              v-else-if="currentStep === 'specialty-form' && currentSpecialtyForm"
              :is="currentSpecialtyForm"
              :key="'specialty-form'"
              @submit="handleNext"
              @back="handleBack"
            />

            <!-- Appointment Time Step -->
            <AppointmentTimeForm
              v-else-if="currentStep === 'appointment-time'"
              :key="'appointment-time'"
              @submit="handleNext"
              @back="handleBack"
            />

            <!-- Confirmation Step -->
            <div v-else-if="currentStep === 'confirmation'" :key="'confirmation'" class="space-y-6">
              <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                  Review Your Appointment
                </h2>
                <p class="text-neutral-600 dark:text-neutral-400">
                  Please verify all information before confirming
                </p>
              </div>

              <!-- Doctor Info -->
              <div class="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5">
                <h3 class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-4">
                  Doctor
                </h3>
                <div class="flex items-center gap-4">
                  <img :src="doctor.avatar" :alt="doctor.name" class="w-16 h-16 rounded-2xl ring-2 ring-neutral-200 dark:ring-neutral-700" />
                  <div>
                    <p class="font-bold text-lg text-neutral-900 dark:text-white">{{ doctor.name }}</p>
                    <p class="text-primary-600 dark:text-primary-400 font-semibold">{{ doctor.specialtyLabel }}</p>
                    <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{{ doctor.experience }} years of experience</p>
                  </div>
                </div>
              </div>

              <!-- Appointment Details -->
              <div class="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5">
                <h3 class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-4">
                  Appointment
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">Date</p>
                    <p class="font-semibold text-neutral-900 dark:text-white">
                      {{ new Date(bookingStore.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
                    </p>
                  </div>
                  <div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">Time</p>
                    <p class="font-semibold text-neutral-900 dark:text-white">{{ bookingStore.appointmentTime }}</p>
                  </div>
                  <div class="sm:col-span-2">
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">Reason for Visit</p>
                    <p class="font-semibold text-neutral-900 dark:text-white">{{ bookingStore.appointmentReason }}</p>
                  </div>
                </div>
              </div>

              <!-- Patient Info -->
              <div class="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5">
                <h3 class="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-4">
                  Patient
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">Name</p>
                    <p class="font-semibold text-neutral-900 dark:text-white">
                      {{ bookingStore.patientInfo.firstName }} {{ bookingStore.patientInfo.lastName }}
                    </p>
                  </div>
                  <div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">Email</p>
                    <p class="font-semibold text-neutral-900 dark:text-white">{{ bookingStore.patientInfo.email }}</p>
                  </div>
                  <div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">Phone</p>
                    <p class="font-semibold text-neutral-900 dark:text-white">{{ bookingStore.patientInfo.phone }}</p>
                  </div>
                </div>
              </div>

              <!-- Price Summary -->
              <div class="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-5">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-primary-700 dark:text-primary-300">Consultation Fee</p>
                    <p class="text-2xl font-bold text-primary-800 dark:text-primary-200">${{ doctor.consultationFee }}</p>
                  </div>
                  <div class="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                    Pay at Visit
                  </div>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="submitError" class="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl p-4 flex items-start gap-3">
                <ExclamationCircleIcon class="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-semibold text-error-700 dark:text-error-300">Booking Failed</p>
                  <p class="text-sm text-error-600 dark:text-error-400">{{ submitError }}</p>
                </div>
              </div>

              <!-- Terms Notice -->
              <div class="bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-xl p-4">
                <p class="text-sm leading-relaxed text-accent-700 dark:text-accent-300">
                  By confirming this appointment, you agree to our terms of service and privacy policy.
                  You will receive a confirmation email shortly.
                </p>
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  @click="handleBack"
                  :disabled="isSubmitting"
                  class="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 rounded-xl font-semibold transition-all duration-200 group disabled:opacity-50"
                >
                  <ArrowLeftIcon class="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                  Back
                </button>
                <button
                  @click="handleConfirm"
                  :disabled="isSubmitting"
                  class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-xl font-semibold transition-all duration-200 flex-1 group disabled:opacity-50"
                >
                  <svg
                    v-if="isSubmitting"
                    class="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span v-else>Confirm Appointment</span>
                  <span v-if="isSubmitting">Booking...</span>
                  <ArrowRightIcon v-if="!isSubmitting" class="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

  </div>
</template>
