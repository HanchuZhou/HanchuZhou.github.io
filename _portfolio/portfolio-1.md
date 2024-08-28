---
title: "CarDreamer: World-Model-Based Autonomous Driving Platform"
excerpt: "The first open-source platform for world-model-based autonomous driving.<br/><img src='/images/CarDreamerSystem.png'>"
collection: portfolio
---

To safely navigate intricate real-world scenarios, autonomous vehicles (AVs) must be able to adapt to diverse road conditions and anticipate future events. World model based reinforcement learning (RL) has emerged as a promising approach by learning and predicting the complex dynamics of various environments. Nevertheless, to the best of our knowledge,  there  does not exist an open-source platform for   training and testing such algorithms in complicated driving environments.

To fill this void, we introduce CarDreamer, the first open-source learning platform designed specifically for developing and evaluating world model based autonomous driving algorithms. It comprises a few key components, including
1. World model (WM) backbone: CarDreamer has integrated some state-of-the-art world models, which simplifies the reproduction of RL algorithms.
2. Built-in tasks:  CarDreamer offers a comprehensive set of highly configurable driving tasks which are compatible with Gym interfaces and are equipped with empirically optimized reward functions.
3. Task development suite: CarDreamer integrates a flexible task development suite to streamline the creation of driving tasks. This suite enables easy definition of traffic flows and vehicle routes, along with automatic collection of multi-modal observation data.

Furthermore, we conduct extensive experiments using built-in tasks to evaluate the performance and potential of WMs in autonomous driving.
Thanks to the richness and flexibility of CarDreamer, we also systematically study the impact of observation modality, observability, and sharing of vehicle intentions on AV safety and efficiency. All code and documents are accessible on our [GitHub page](https://github.com/ucd-dare/CarDreamer).

<img src='/images/CarDreamerSystem.png'>
