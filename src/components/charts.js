import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Palette used across every chart (teal first, then warm and cool accents).
export const CHART_COLORS = [
  '#0e6b68', '#e3a23a', '#3d7ab8', '#c8563b', '#7c9a3e', '#8a5fb3',
  '#d17aa0', '#4aa3a0', '#a67c52', '#5c6b73', '#b8a33a', '#2f8f5b',
];

export const colorAt = (i) => CHART_COLORS[i % CHART_COLORS.length];

export const INK = '#1e2428';
export const TRACK = '#e4eae8';
