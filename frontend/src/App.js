import React, { useState } from 'react';
import SendPanel from './sendpanel';
import ReceivePanel from './receievepanel';
import DeviceNamePopup from './devicename';

const App = () => {
  const [page, setPage] = useState('send');
  const [nameSet, setNameSet] = useState(
    () => !!localStorage.getItem("deviceNameSet")  // check once on mount
  );

  return (
    <>
      {!nameSet && <DeviceNamePopup onComplete={() => setNameSet(true)} />}
      {page === 'send'
        ? <SendPanel onNavigate={setPage} />
        : <ReceivePanel onNavigate={setPage} />}
    </>
  );
};

export default App;