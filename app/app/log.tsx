import { Redirect } from 'expo-router';

export default function LogRedirectScreen() {
  return <Redirect href={{ pathname: '/activity', params: { action: 'logFood' } }} />;
}
