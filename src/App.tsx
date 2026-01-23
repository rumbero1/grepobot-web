import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

const Dashboard: React.FC = () => {
    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome to the Dashboard!</p>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <Switch>
                <Route path="/" component={Dashboard} />
            </Switch>
        </Router>
    );
};

export default App;