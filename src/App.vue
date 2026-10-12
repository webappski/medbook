<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import {
  SunIcon,
  MoonIcon,
  HeartIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/vue/24/outline';

const { isDark, toggleTheme } = useTheme();
const route = useRoute();
const isMobileMenuOpen = ref(false);

// Hide header/footer on auth, cabinet and admin pages
const showHeader = computed(() => {
  return !route.path.startsWith('/auth') &&
         !route.path.startsWith('/cabinet') &&
         !route.path.startsWith('/admin');
});

const showFooter = computed(() => {
  return !route.path.startsWith('/auth') &&
         !route.path.startsWith('/cabinet') &&
         !route.path.startsWith('/admin');
});

// Close mobile menu on route change
watch(() => route.path, () => {
  isMobileMenuOpen.value = false;
});

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Skip to content link for accessibility -->
    <a href="#main-content" class="skip-link">
      Skip to main content
    </a>

    <!-- Theme Toggle Button -->
    <button
      v-if="showHeader"
      @click="toggleTheme"
      class="theme-toggle"
      aria-label="Toggle dark mode"
    >
      <SunIcon v-if="isDark" class="w-5 h-5 text-warning-500" />
      <MoonIcon v-else class="w-5 h-5 text-primary-600" />
    </button>

    <!-- Header -->
    <header
      v-if="showHeader"
      class="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-neutral-200 dark:border-neutral-800"
    >
      <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <router-link to="/" class="flex items-center gap-3 group">
            <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-soft group-hover:shadow-glow-primary transition-shadow duration-300">
              <HeartIcon class="w-6 h-6 text-white" />
            </div>
            <span class="text-xl font-bold text-neutral-900 dark:text-white">
              Med<span class="text-primary-600 dark:text-primary-400">Book</span>
            </span>
          </router-link>

          <!-- Desktop Navigation -->
          <div class="hidden md:flex items-center gap-8">
            <router-link
              to="/"
              class="nav-link"
              :class="{ 'nav-link-active': route.path === '/' }"
            >
              Home
            </router-link>
            <router-link
              to="/doctors"
              class="nav-link"
              :class="{ 'nav-link-active': route.path === '/doctors' || route.path.startsWith('/booking') }"
            >
              Find Doctors
            </router-link>
            <router-link
              to="/cabinet"
              class="nav-link"
              :class="{ 'nav-link-active': route.path.startsWith('/cabinet') }"
            >
              My Cabinet
            </router-link>
          </div>

          <!-- Desktop CTA -->
          <div class="hidden md:flex items-center gap-4">
            <router-link
              to="/admin"
              class="btn btn-sm bg-primary-600 text-white hover:bg-primary-700 shadow-soft hover:shadow-soft-md"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin
            </router-link>
          </div>

          <!-- Mobile Menu Button -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden btn-icon"
            aria-label="Toggle menu"
            :aria-expanded="isMobileMenuOpen"
          >
            <Bars3Icon v-if="!isMobileMenuOpen" class="w-6 h-6" />
            <XMarkIcon v-else class="w-6 h-6" />
          </button>
        </div>
      </nav>

      <!-- Mobile Navigation Drawer -->
      <Transition
        enter-active-class="transition-all duration-300 ease-smooth"
        leave-active-class="transition-all duration-200 ease-smooth"
        enter-from-class="opacity-0 -translate-y-4"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div
          v-if="isMobileMenuOpen"
          class="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-soft-lg"
        >
          <div class="px-4 py-6 space-y-4">
            <router-link
              to="/"
              @click="closeMobileMenu"
              class="block px-4 py-3 rounded-xl font-medium transition-colors"
              :class="route.path === '/'
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'"
            >
              Home
            </router-link>
            <router-link
              to="/doctors"
              @click="closeMobileMenu"
              class="block px-4 py-3 rounded-xl font-medium transition-colors"
              :class="route.path === '/doctors' || route.path.startsWith('/booking')
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'"
            >
              Find Doctors
            </router-link>
            <router-link
              to="/cabinet"
              @click="closeMobileMenu"
              class="block px-4 py-3 rounded-xl font-medium transition-colors"
              :class="route.path.startsWith('/cabinet')
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'"
            >
              My Cabinet
            </router-link>

            <div class="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <router-link
                to="/admin"
                @click="closeMobileMenu"
                class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin Panel
              </router-link>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <!-- Mobile Menu Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showHeader && isMobileMenuOpen"
        class="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
        @click="closeMobileMenu"
      />
    </Transition>

    <!-- Main Content -->
    <main id="main-content" class="flex-1">
      <RouterView />
    </main>



    <!-- Footer -->
    <footer
      v-if="showFooter"
      class="bg-neutral-100 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 mt-auto"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <!-- Brand -->
          <div class="md:col-span-2">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                <HeartIcon class="w-6 h-6 text-white" />
              </div>
              <span class="text-xl font-bold text-neutral-900 dark:text-white">
                Med<span class="text-primary-600 dark:text-primary-400">Book</span>
              </span>
            </div>
            <p class="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed max-w-md">
              Your wellness journey starts here. Connect with trusted healthcare professionals and take control of your health with our modern booking platform.
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h4 class="font-semibold text-neutral-900 dark:text-white mb-4">Quick Links</h4>
            <ul class="space-y-2">
              <li>
                <router-link to="/" class="text-sm text-neutral-600 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 transition-colors">
                  Home
                </router-link>
              </li>
              <li>
                <router-link to="/doctors" class="text-sm text-neutral-600 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 transition-colors">
                  Find Doctors
                </router-link>
              </li>
              <li>
                <router-link to="/cabinet" class="text-sm text-neutral-600 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 transition-colors">
                  My Cabinet
                </router-link>
              </li>
            </ul>
          </div>

          <!-- Contact -->
          <div>
            <h4 class="font-semibold text-neutral-900 dark:text-white mb-4">Contact</h4>
            <ul class="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li>hello@medbook.care</li>
              <li>+1 (555) 123-4567</li>
            </ul>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800">
          <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p class="text-sm text-neutral-500 dark:text-neutral-500">
              2026 MedBook. All rights reserved.
            </p>
            <p class="text-xs text-neutral-400 dark:text-neutral-600">
              Demo Application - Modern Healthcare Booking
            </p>
          </div>
        </div>
      </div>
    </footer>
  </div>
  <typeless-form api-key="tf_c6nNc9_h80Dcg_slvbzTRY9T7XUH81mm"></typeless-form>
</template>
