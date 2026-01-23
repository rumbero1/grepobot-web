import React from 'react';

const App: React.FC = () => {
    const features = [
        'Real-time data processing',
        'User-friendly interface',
        'Advanced analytics',
        'Multi-platform support',
        'Seamless integrations'
    ];

    return (
        <div>
            <h1>GrepoBot Pro</h1>
            <nav>
                <ul>
                    <li><a href="/landing">Landing</a></li>
                    <li><a href="/admin">Admin</a></li>
                </ul>
            </nav>
            <h2>Upcoming Features:</h2>
            <ul>
                {features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                ))}
            </ul>
        </div>
    );
};

export default App;