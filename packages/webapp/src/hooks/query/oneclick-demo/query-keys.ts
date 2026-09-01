// OneClick Demo module doesn't have specific query keys defined in types.tsx
// Query keys are defined locally in the queries file

// Query key factory (for future use)
export const oneClickDemoKeys = {
  all: () => ['ONECLICK_DEMO'] as const,
};

// Grouped object for use in components/hooks
export const OneClickDemoQueryKeys = {
  ONECLICK_DEMO: 'ONECLICK_DEMO',
} as const;
