
import { useFonts as useExpoFonts } from 'expo-font';

export const useFonts = () => {
  const [fontsLoaded] = useExpoFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Lora-Regular': require('../assets/fonts/Lora-Regular.ttf'),
    'Lora-Medium': require('../assets/fonts/Lora-Medium.ttf'),
    'Lora-SemiBold': require('../assets/fonts/Lora-SemiBold.ttf'),
    'Lora-Bold': require('../assets/fonts/Lora-Bold.ttf'),
  });

  return fontsLoaded;
};
