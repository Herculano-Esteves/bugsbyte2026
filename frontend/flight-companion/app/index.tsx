import { useEffect } from 'react';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Home() {
    const { isAuthenticated, isGuest, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            // Allow both authenticated users and guests to access tabs
            if (isAuthenticated || isGuest) {
                router.replace('/(tabs)/main');
            } else {
                router.replace('/auth/login');
            }
        }
    }, [isAuthenticated, isGuest, isLoading]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#667eea" />
            </View>
        );
    }

    // Fallback redirect (should not reach here due to useEffect)
    return (isAuthenticated || isGuest) ? <Redirect href="/(tabs)/main" /> : <Redirect href="/auth/login" />;
}
