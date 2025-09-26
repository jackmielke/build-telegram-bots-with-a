import Navbar from '@/components/Navbar';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        <Dashboard />
      </div>
    </div>
  );
};

export default Index;
