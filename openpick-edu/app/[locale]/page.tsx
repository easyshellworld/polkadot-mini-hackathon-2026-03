import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ChatContainer from '../../components/ChatContainer';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* <h1 className="text-3xl font-bold mb-8 text-center">主页</h1> */}
          <ChatContainer />
        </div>
      </main>
      <Footer />
    </div>
  );
}