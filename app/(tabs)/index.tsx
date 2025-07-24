import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type Message = {
  id: string;
  type: 'text' | 'image' | 'pdf';
  content: string;
  name?: string;
  sender: 'user' | 'ai';
};

function TypingLoader() {
  const [dotCount, setDotCount] = useState(1);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDotCount((prev) => (prev === 3 ? 1 : prev + 1));
    }, 400) as unknown as number;
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <View style={{ marginBottom: 12, alignItems: 'flex-start' }}>
      <View style={[styles.textMsg, styles.aiMsg, { flexDirection: 'row', alignItems: 'center', width: 60, height: 32 }]}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#fff',
              marginHorizontal: 4,
              opacity: dotCount > i ? 1 : 0.3,
              transform: [{ scale: dotCount === i + 1 ? 1.3 : 1 }],
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [chats, setChats] = useState([{ id: '1', messages: [] as Message[] }]);
  const [activeChatId, setActiveChatId] = useState('1');
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-Dimensions.get('window').width * 0.7)).current;

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: sidebarOpen ? 0 : -Dimensions.get('window').width * 0.7,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [sidebarOpen]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const uniqueId = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8);
    const userMsg: Message = { id: uniqueId, type: 'text', content: input, sender: 'user' };
    setInput('');
    setLoading(true);
    setChats(prev => prev.map(chat =>
      chat.id === activeChatId
        ? { ...chat, messages: [...chat.messages, userMsg] }
        : chat
    ));
    try {
      const apiKey = '';
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: input }]
            }
          ]
        }),
      });
      const data = await response.json();
      const geminiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, no response.';
      const aiMsg: Message = { id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8), type: 'text', content: geminiReply, sender: 'ai' };
      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, aiMsg] }
          : chat
      ));
    } catch (err) {
      const aiMsg: Message = { id: Date.now().toString(), type: 'text', content: 'Error contacting Gemini.', sender: 'ai' };
      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, aiMsg] }
          : chat
      ));
    }
    setLoading(false);
  };

  const handleAttach = async () => {
    setUploading(true);
    const imageResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });
    if (!imageResult.canceled && imageResult.assets?.length) {
      const imgMsg: Message = {
        id: Date.now().toString(),
        type: 'image',
        content: imageResult.assets[0].uri,
        name: imageResult.assets[0].fileName ?? undefined,
        sender: 'user'
      };
      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, imgMsg] }
          : chat
      ));
      setUploading(false);
      return;
    }

    const docResult = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf'],
      copyToCacheDirectory: true,
    });
    if (docResult && docResult.assets?.length) {
      const asset = docResult.assets[0];
      const pdfMsg: Message = {
        id: Date.now().toString(),
        type: 'pdf',
        content: asset.uri,
        name: asset.name ?? undefined,
        sender: 'user'
      };
      setChats(prev => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, pdfMsg] }
          : chat
      ));
    }
    setUploading(false);
  };

  const handleNewChat = () => {
    const newId = (Date.now()).toString();
    setChats(prev => [...prev, { id: newId, messages: [] }]);
    setActiveChatId(newId);
    setSidebarOpen(false);
  };

  const renderSidebar = () => (
    <Animated.View style={[styles.sidebar, { left: sidebarAnim }]}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>Chats</Text>
        <TouchableOpacity onPress={() => setSidebarOpen(false)} style={styles.closeSidebarBtn}>
          <Text style={{ fontSize: 22, color: '#fff' }}>×</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {chats.map(chat => (
          <TouchableOpacity
            key={chat.id}
            style={[styles.chatListItem, chat.id === activeChatId && styles.activeChatListItem]}
            onPress={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
          >
            <Text style={{ color: '#fff' }}>Chat #{chat.id.slice(-4)}</Text>
            <Text style={{ color: '#aaa', fontSize: 12 }}>{chat.messages.length} msg</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
        <Text style={{ color: '#222', fontWeight: 'bold' }}>+ New Chat</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // Conditionally wrap content with KeyboardAvoidingView for mobile only
  const Content = (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' }}
      style={styles.bg}
      imageStyle={{ opacity: 0.3 }}
    >
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png' }}
          style={styles.logo}
        />
        <Text style={styles.appName}>FinAI</Text>
        <TouchableOpacity style={styles.burgerBtn} onPress={() => setSidebarOpen(true)}>
          <View style={styles.burgerIcon}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </View>
        </TouchableOpacity>
      </View>

      {renderSidebar()}

      <View style={styles.overlay}>
        <ScrollView
          style={styles.messages}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={{
                marginBottom: 12,
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.type === 'text' && (
                <Text style={[styles.textMsg, msg.sender === 'user' ? styles.userMsg : styles.aiMsg]}>
                  {msg.content}
                </Text>
              )}
              {msg.type === 'image' && (
                <Image source={{ uri: msg.content }} style={[styles.uploadedImage, msg.sender === 'user' ? styles.userMsg : styles.aiMsg]} />
              )}
              {msg.type === 'pdf' && (
                <TouchableOpacity onPress={() => {}} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.pdfText, msg.sender === 'user' ? styles.userMsg : styles.aiMsg]}>
                    📄 {msg.name || 'Document'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {loading && <TypingLoader />}
        </ScrollView>

        <View style={styles.chatInputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={handleAttach} disabled={uploading}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/60/60525.png' }}
              style={styles.attachIcon}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#aaa"
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={!input.trim()}>
            <Text style={{ color: 'white' }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );

  return Platform.OS === 'web' ? (
    <View style={{ flex: 1 }}>
      {Content}
    </View>
  ) : (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {Content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    resizeMode: 'cover',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,30,0.95)',
    paddingHorizontal: 18,
    paddingTop: 36,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#222',
    justifyContent: 'space-between',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  appName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
    flex: 1,
  },
  burgerBtn: {
    padding: 8,
    marginLeft: 12,
  },
  burgerIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  burgerLine: {
    width: 22,
    height: 3,
    backgroundColor: '#fff',
    marginVertical: 2,
    borderRadius: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,20,30,0.85)',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  messages: {
    flex: 1,
    padding: 16,
  },
  textMsg: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(40,40,60,0.7)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 2,
    maxWidth: '80%',
  },
  userMsg: {
    backgroundColor: '#fbbf24',
    color: '#222',
    alignSelf: 'flex-end',
    borderTopRightRadius: 0,
  },
  aiMsg: {
    backgroundColor: 'rgba(40,40,60,0.7)',
    color: '#fff',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 0,
  },
  uploadedImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  pdfText: {
    color: '#fbbf24',
    fontWeight: 'bold',
    marginTop: 4,
    backgroundColor: 'rgba(40,40,60,0.7)',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#333',
    backgroundColor: 'rgba(30,30,40,0.95)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  attachButton: {
    marginRight: 8,
    padding: 4,
  },
  attachIcon: {
    width: 28,
    height: 28,
    tintColor: '#fbbf24',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    backgroundColor: '#222',
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 4,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: Dimensions.get('window').width * 0.7,
    backgroundColor: 'rgba(30,30,40,0.98)',
    zIndex: 100,
    paddingTop: 36,
    borderRightWidth: 1,
    borderColor: '#222',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  sidebarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeSidebarBtn: {
    padding: 4,
  },
  chatListItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#222',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  activeChatListItem: {
    backgroundColor: 'rgba(40,40,60,0.5)',
  },
  newChatBtn: {
    backgroundColor: '#fbbf24',
    padding: 12,
    margin: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
});