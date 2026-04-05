import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

const MealPlanner = () => (
  <div className="foodsync-content animate-fade-in px-4 py-10 sm:px-8">
    <div className="glass-card-strong mx-auto max-w-lg p-10 text-center">
      <UtensilsCrossed className="mx-auto mb-4 h-12 w-12 text-sage-dark opacity-80" />
      <h1 className="font-display text-2xl font-bold text-text">Meal planner</h1>
      <p className="mt-3 text-muted">Coming soon — plan meals around your scans and diet profile.</p>
    </div>
  </div>
);

export default MealPlanner;
