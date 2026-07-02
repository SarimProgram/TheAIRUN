// app/app/runs/easyrun.tsx
// Thin wrapper for Easy Run - uses the unified RunSessionScreen engine

import { Redirect } from 'expo-router';

export default function EasyRunScreen() {
    // Redirect to the main run screen with easy template
    return (
        <Redirect
            href={{
                pathname: '/runs/runscreen',
                params: {
                    templateId: 'easy',
                    weekContext: 'WEEK 1 / FOUNDATION',
                }
            }}
        />
    );
}