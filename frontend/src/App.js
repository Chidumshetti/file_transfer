import React, { useState } from 'react';
import SendPanel from './sendpanel';
import ReceivePanel from './receievepanel';

const App = () => {
  const [page, setPage] = useState('send');

  return page === 'send'
    ? <SendPanel onNavigate={setPage} />
    : <ReceivePanel onNavigate={setPage} />;
};

export default App;