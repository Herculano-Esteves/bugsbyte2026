import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAIChat, Message } from '../hooks/useAIChat';
import { AICommand } from '../services/aiApi';

const AI_ICON = require('../assets/Icons/AI.png');

export function AIChatModal() {
  const [modalVisible, setModalVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { messages, isLoading, error, lastCommand, sendMessage, clearLastCommand } = useAIChat();

  // Pulse animation for the FAB
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    sendMessage(inputText);
    setInputText('');
  };

  // React to AI commands
  const executeCommand = useCallback(
    (command: AICommand) => {
      if (!command) return;

      // Small delay so user can see the AI's response before navigating
      const delay = 1200;

      switch (command) {
        case 'OPEN_SCANNER':
          setTimeout(async () => {
            setModalVisible(false);
            await AsyncStorage.setItem('ai_action_request', 'OPEN_SCANNER');
            router.push('/(tabs)/main');
          }, delay);
          break;
        case 'OPEN_GALLERY':
          setTimeout(async () => {
            setModalVisible(false);
            await AsyncStorage.setItem('ai_action_request', 'OPEN_GALLERY');
            router.push('/(tabs)/main');
          }, delay);
          break;
        case 'GO_HOME':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/(tabs)/main');
          }, delay);
          break;
        case 'GO_INFLIGHT':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/(tabs)/inFlight');
          }, delay);
          break;
        case 'GO_SEARCH':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/(tabs)/search');
          }, delay);
          break;
        case 'GO_PROFILE':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/(tabs)/perfil');
          }, delay);
          break;
        case 'GO_TRANSPORTS':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/(tabs)/posFlight');
          }, delay);
          break;
        case 'GO_BOARDING_PASS':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/(tabs)/boardingpass');
          }, delay);
          break;
        case 'GO_LOGIN':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/auth/login');
          }, delay);
          break;
        case 'GO_REGISTER':
          setTimeout(() => {
            setModalVisible(false);
            router.push('/auth/register');
          }, delay);
          break;
        default:
          break;
      }

      clearLastCommand();
    },
    [clearLastCommand]
  );

  // When a new command arrives, execute it
  useEffect(() => {
    if (lastCommand) {
      executeCommand(lastCommand);
    }
  }, [lastCommand, executeCommand]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && modalVisible) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages, modalVisible]);

  // Friendly command label for the action pill
  const getCommandLabel = (command: AICommand): string | null => {
    const labels: Record<string, string> = {
      OPEN_SCANNER: '📷 Opening camera...',
      OPEN_GALLERY: '🖼️ Opening gallery...',
      GO_HOME: '🏠 Going home...',
      GO_INFLIGHT: '✈️ Opening In Flight...',
      GO_SEARCH: '🔍 Opening Search...',
      GO_PROFILE: '👤 Opening Profile...',
      GO_TRANSPORTS: '🚌 Opening Tour Planner...',
      GO_BOARDING_PASS: '🎫 Opening Boarding Pass...',
      GO_LOGIN: '🔑 Opening Login...',
      GO_REGISTER: '📝 Opening Registration...',
    };
    return command ? labels[command] || null : null;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const commandLabel = item.command ? getCommandLabel(item.command) : null;

    return (
      <View
        style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}
      >
        {!isUser && (
          <View style={styles.aiAvatarContainer}>
            <Image source={AI_ICON} style={styles.aiAvatarSmall} />
          </View>
        )}
        <View style={{ maxWidth: '80%' }}>
          {/* Command action pill */}
          {commandLabel && (
            <View style={styles.commandPill}>
              <Text style={styles.commandPillText}>{commandLabel}</Text>
            </View>
          )}
          <View
            style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}
          >
            <Text style={[styles.messageText, isUser && styles.userMessageText]}>
              {item.content}
            </Text>
            <Text style={styles.timestamp}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Image source={AI_ICON} style={styles.fabIcon} />
        </TouchableOpacity>
      </Animated.View>

      {/* Chat Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <BlurView intensity={90} tint="dark" style={styles.modalContainer}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Image source={AI_ICON} style={styles.headerIcon} />
                <View>
                  <Text style={styles.headerTitle}>Flight Companion AI</Text>
                  <Text style={styles.headerSubtitle}>Ask me anything about your trip</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Image source={AI_ICON} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>Hi! I'm your AI assistant ✈️</Text>
                  <Text style={styles.emptyText}>
                    Ask me anything about your flight, destination, or I can help you navigate the app!
                  </Text>

                  {/* Quick action buttons */}
                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      style={styles.quickButton}
                      onPress={() => sendMessage('I want to scan my boarding pass')}
                    >
                      <Text style={styles.quickButtonText}>📷 Scan ticket</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickButton}
                      onPress={() => sendMessage("What's there to do in Porto?")}
                    >
                      <Text style={styles.quickButtonText}>🏛️ Porto tips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickButton}
                      onPress={() => sendMessage('Show me travel articles')}
                    >
                      <Text style={styles.quickButtonText}>🔍 Explore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickButton}
                      onPress={() => sendMessage('Show me my profile')}
                    >
                      <Text style={styles.quickButtonText}>👤 Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              }
            />

            {/* Loading indicator */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#00e5ff" />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            )}

            {/* Error display */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Input area */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask me anything..."
                  placeholderTextColor="#666"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                >
                  <Text style={styles.sendButtonArrow}>→</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </BlurView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 1000,
  },
  floatingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  fabIcon: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
    borderRadius: 17,
  },
  modalContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    marginRight: 12,
    borderRadius: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#ccc',
    fontSize: 24,
    lineHeight: 24,
  },
  messagesList: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    opacity: 0.6,
    marginBottom: 16,
    borderRadius: 35,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  quickButton: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickButtonText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '600',
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  userBubble: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  aiAvatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  aiAvatarSmall: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    borderRadius: 9,
  },
  messageContent: {
    padding: 12,
    borderRadius: 16,
    minWidth: 60,
  },
  userContent: {
    backgroundColor: '#00e5ff',
    borderBottomRightRadius: 4,
  },
  aiContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#1a1a2e',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  commandPill: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  commandPillText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  loadingText: {
    color: '#00e5ff',
    marginLeft: 8,
    fontSize: 12,
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#fff',
    marginRight: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00e5ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendButtonArrow: {
    color: '#1a1a2e',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
