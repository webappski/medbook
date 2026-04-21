import type { Handler } from '@netlify/functions';
import { supabase, supabaseAdmin, jsonResponse, errorResponse, corsHeaders } from './lib/supabase';

function generateAppointmentId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `APT-${date}-${seq}`;
}

function generateConfirmationNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'CONF-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Type definitions for the expanded API
interface PatientInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
}

interface MedicalHistory {
  allergies?: string;
  chronicConditions?: string;
  currentMedications?: string;
  previousSurgeries?: string;
  familyHistory?: string;
  bloodType?: string;
  smokingStatus?: 'never' | 'former' | 'current';
  alcoholConsumption?: 'none' | 'occasional' | 'moderate' | 'heavy';
}

interface AppointmentRequestBody {
  doctorId: string;
  slotId?: string;
  slotDate?: string;
  slotStartTime?: string;
  specialty?: string;
  patient: PatientInfo;
  medicalHistory?: MedicalHistory;
  specialtyFormData?: Record<string, unknown>;
  reason: string;
  notes?: string;
  // Legacy field support
  medicalInfo?: Record<string, unknown>;
}

/** Look up a registered patient's UUID by email (bypasses RLS via admin client) */
async function lookupPatientId(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

function validateSpecialtyFields(_specialty: string, _data: any = {}): string[] {
  // Specialty-specific validation disabled for now
  // Widget collects generic patient info; specialty forms can be added later
  return [];
}

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const path = event.path
    .replace('/.netlify/functions/appointments', '')
    .replace('/api/appointments', '');
  const appointmentId = path.replace('/', '');

  // GET /api/appointments/:id
  if (event.httpMethod === 'GET' && appointmentId) {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select('*, doctors(*)')
      .eq('id', appointmentId)
      .single();

    if (error || !appointment) {
      return errorResponse('Appointment not found', 'NOT_FOUND', 404);
    }

    return jsonResponse({
      appointmentId: appointment.id,
      confirmationNumber: appointment.confirmation_number,
      status: appointment.status,
      specialty: appointment.specialty,
      doctor: {
        id: appointment.doctors.id,
        name: appointment.doctors.name,
        specialty: appointment.doctors.specialty_label,
      },
      patient: {
        firstName: appointment.first_name,
        lastName: appointment.last_name,
        email: appointment.email,
        phone: appointment.phone,
        dateOfBirth: appointment.date_of_birth,
        gender: appointment.gender,
        address: appointment.address,
        emergencyContact: appointment.emergency_contact,
        emergencyPhone: appointment.emergency_phone,
      },
      medicalHistory: appointment.medical_history || {},
      specialtyFormData: appointment.specialty_form_data || {},
      slot: {
        date: appointment.slot_date,
        startTime: appointment.slot_start_time,
        endTime: appointment.slot_end_time,
      },
      reason: appointment.reason,
      notes: appointment.notes,
      consultationFee: parseFloat(appointment.doctors.consultation_fee),
      createdAt: appointment.created_at,
    });
  }

  // POST /api/appointments
  if (event.httpMethod === 'POST') {
    const idempotencyKey = event.headers['x-idempotency-key'];

    // Check for duplicate request
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('appointments')
        .select('id, confirmation_number')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (existing) {
        return jsonResponse({
          appointmentId: existing.id,
          confirmationNumber: existing.confirmation_number,
          status: 'confirmed',
          message: 'Appointment already exists (idempotent response)',
        });
      }
    }

    let body: AppointmentRequestBody;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return errorResponse('Invalid JSON body', 'INVALID_BODY', 400);
    }

    const {
      doctorId,
      slotId,
      slotDate,
      slotStartTime,
      specialty,
      patient,
      medicalHistory,
      specialtyFormData,
      reason,
      notes,
      // Legacy support
      medicalInfo,
    } = body;

    // Validate required fields
    const missingFields: string[] = [];

    // 1. Validate Patient Info
    if (!patient?.firstName) missingFields.push('patient.firstName');
    if (!patient?.lastName) missingFields.push('patient.lastName');
    if (!patient?.email) missingFields.push('patient.email');
    if (!patient?.phone) missingFields.push('patient.phone');
    if (!patient?.dateOfBirth) missingFields.push('patient.dateOfBirth');
    if (!patient?.gender) missingFields.push('patient.gender');
    if (!patient?.address) missingFields.push('patient.address');
    if (!patient?.emergencyContact) missingFields.push('patient.emergencyContact');
    if (!patient?.emergencyPhone) missingFields.push('patient.emergencyPhone');

    // 2. Validate Reason
    if (!reason) missingFields.push('reason');

    // 3. Validate Medical History (Mandatory fields)
    // Note: medicalHistory might be merged from medicalInfo, so check finalMedicalHistory later or check body prop now?
    // The legacy `medicalInfo` might not have structure. Let's check `medicalHistory` from body if present.
    // However, for backward compatibility we might want to skip this if only medicalInfo is provided?
    // User asked for enforcement. Let's assume new flow.
    if (medicalHistory) {
        if (!medicalHistory.smokingStatus) missingFields.push('medicalHistory.smokingStatus');
        if (!medicalHistory.alcoholConsumption) missingFields.push('medicalHistory.alcoholConsumption');
    }

    // 4. Validate Specialty Data
    // We need doctor specialty. We fetch doctor later.
    // BUT we can use the `specialty` field from body if available (it is passed from frontend).
    // Or we fetch doctor first then validate. 
    // The current code fetches doctor AFTER basic validation. 
    // Let's defer specialty validation until after doctor fetch OR use body specialty if trusted.
    // Frontend sends `specialty`. Let's use it for early fail, or better, wait for doctor fetch.
    // Let's do basic first.
    
    if (missingFields.length > 0) {
      return errorResponse(`Missing required fields: ${missingFields.join(', ')}`, 'VALIDATION_ERROR', 400);
    }

    // Get doctor info for response
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', doctorId)
      .single();

    if (doctorError || !doctor) {
      return errorResponse('Doctor not found', 'DOCTOR_NOT_FOUND', 404);
    }

    // Generate IDs
    const appointmentIdGen = generateAppointmentId();
    const confirmationNumber = generateConfirmationNumber();
    const finalSlotId = slotId || `slot_${Date.now()}`;
    const finalSlotDate = slotDate || new Date().toISOString().slice(0, 10);
    const finalStartTime = slotStartTime || '09:00';
    const finalSpecialty = specialty || doctor.specialty;

    // Validate Specialty Fields using the confirmed specialty
    const specialtyValidationErrors = validateSpecialtyFields(finalSpecialty, specialtyFormData);
    if (specialtyValidationErrors.length > 0) {
        return errorResponse(`Missing required specialty fields: ${specialtyValidationErrors.join(', ')}`, 'VALIDATION_ERROR', 400);
    }

    // Calculate end time (30 min slots)
    const [hours, minutes] = finalStartTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + 30;
    const slotEndTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // Create slot first (FK constraint requires slot to exist)
    const { error: slotError } = await supabase
      .from('slots')
      .upsert({
        id: finalSlotId,
        doctor_id: doctorId,
        date: finalSlotDate,
        start_time: finalStartTime,
        end_time: slotEndTime,
        status: 'booked',
        appointment_id: appointmentIdGen,
      });

    if (slotError) {
      console.error('Slot error:', slotError);
      return errorResponse('Failed to reserve slot', 'SLOT_ERROR', 500);
    }

    // Merge legacy medicalInfo with new medicalHistory
    const finalMedicalHistory = medicalHistory || medicalInfo || {};

    // Link appointment to registered user (if email matches a profile)
    const patientId = await lookupPatientId(patient.email);

    // Create appointment with all fields
    const { error: insertError } = await supabase.from('appointments').insert({
      id: appointmentIdGen,
      confirmation_number: confirmationNumber,
      doctor_id: doctorId,
      slot_id: finalSlotId,
      slot_date: finalSlotDate,
      slot_start_time: finalStartTime,
      slot_end_time: slotEndTime,
      specialty: finalSpecialty,
      // Patient basic info
      first_name: patient.firstName,
      last_name: patient.lastName,
      email: patient.email,
      phone: patient.phone || '',
      date_of_birth: patient.dateOfBirth || null,
      // Patient extended info (NEW)
      gender: patient.gender || null,
      address: patient.address || null,
      emergency_contact: patient.emergencyContact || null,
      emergency_phone: patient.emergencyPhone || null,
      // Medical data (NEW - as JSONB)
      medical_history: finalMedicalHistory,
      specialty_form_data: specialtyFormData || {},
      // Legacy field (keeping for backward compatibility)
      medical_info: medicalInfo ? JSON.stringify(medicalInfo) : null,
      // Link to registered user (null for anonymous bookings)
      patient_id: patientId,
      // Appointment details
      reason,
      notes: notes || null,
      idempotency_key: idempotencyKey || null,
      status: 'confirmed',
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return errorResponse('Failed to create appointment', 'DATABASE_ERROR', 500);
    }

    return jsonResponse({
      appointmentId: appointmentIdGen,
      confirmationNumber,
      status: 'confirmed',
      message: 'Appointment booked successfully',
      details: {
        doctor: {
          name: doctor.name,
          specialty: doctor.specialty_label,
        },
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
        },
        dateTime: `${finalSlotDate}T${finalStartTime}:00`,
        duration: 30,
        consultationFee: parseFloat(doctor.consultation_fee),
      },
    });
  }

  return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
};
