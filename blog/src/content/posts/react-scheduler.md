---
title: 深入理解React Scheduler篇
description: 介绍 React 源码中 Scheduler 包的数据结构、设计思想，以及在react中的实际应用。
date: 2026-11-16
tags:
  - 前端
series: 深入理解React
pinned: false
draft: false
---
Scheduler 是 react 包内的一个工具库（utils），为 react reconciler 提供带优先级的**延迟**任务处理、任务**分片**处理能力。

## 背景知识补充

### 浏览器的事件循环

由于JS单线程的特性，浏览用事件循环机制来串行处理函数调用，按照调用方式分为宏任务和微任务。

常见宏任务：`onClick`**、**`setTimeout`、`setInterval`、**`MessageChannel`**、**`postMessage`**

常见微任务：`Promise.then()`、`MutationObserver`、`queueMicrotask()`

一句话解释：在执行宏任务的过程中产生的新的宏任务和微任务，会分别进入宏任务队列和微任务队列。一个宏任务执行完成后，会按顺序清空当前微任务队列，直到为空，再执行下一个宏任务。

```js
console.log(1)

setTimeout(() => console.log(2), 0)

Promise.then(() => console.log(3));

console.log(4);

// 1 4 3 2
```

重点说明：宏任务队列本质是一些队列的集合、不同类型的宏任务、在浏览器中**不是严格FIFO**，这是Scheduler能延迟执行的原因。

## 核心机制

### 数据结构-双优先队列

Scheduler为了判断当前哪个任务更加优先，设计了两个优先队列（堆）。

* taskQueue 按照**过期时间**排序，高优先级任务（过期时间小的）可插队。
* timerQueue 按照延迟时间排序，需要显式传入 delay参数（不同于超时时间），**react中未使用**。

### 与浏览器通信

如补充知识中提到的 `performWorkUntilDeadline` 通过`messageChannel`的回调，在浏览器中是个宏任务，所以在浏览器视角，Schedule可以称为一个宏任务生成器

```js
const channel = new MessageChannel();
const port = channel.port2;

// 监听浏览器 message
channel.port1.onmessage = performWorkUntilDeadline; // 进入任务循环

// 任务分片、但是队列还没清空、告诉浏览器记得再调 Scheduler
schedulePerformWorkUntilDeadline = () => {
  port.postMessage(null);                      
};
```

### 任务循环

Scheduler的任务处理典型过程如下、经过简化

1. 浏览器广播消息，Scheduler 通过 `port1.onmessage` 接收到 `performWorkUntilDeadLine`，开始执行，记录开始时间 startTime
2. 从 taskQueue 中 pop 出任务执行，转2
3. 检查 `Performance.now() - startTime >= 5ms` 且 队首任务没到**过期时间，**&#x8F6C;4，否则转2
4. 在模块级变量保存任务执行状态，调用 `port2.postMessage(null)`，往浏览器宏任务队列放一条宏任务，等待浏览器调用
5. 浏览器事件循环到这条宏任务，广播消息到 port1 ，转1

在这个机制下，每大约5ms浏览器会有一次机会进入事件循环。**即4、5时间间隙之间，浏览器接管了主线程，它此时有机会，处理更高优先级的宏任务、如onClick回调。**

举例：假设在scheduler中、正在排队了的很多的渲染任务（如有5个 onScroll 内部的setState在排队）。在这个机制下，用户点击事件onclick回调可以不用等待单线程的JS处理完所有的这些排队的，而在5ms后最近的setState处理完成后，先处理点击事件，接着继续处理渲染任务。

### 优先级与超时时间

Scheduler对于所有的入队任务，定义了5个维度的优先级，对应5个不同的超时时间，其中react主要使用其中UserBlocking、Normal、Idle三个。

* `Immediate` 立刻执行 -1 超时时间
* `UserBlocking` 阻塞用户操作 250ms 超时时间
* `Normal` 可延迟操作 5000ms 超时时间
* `LowPriority` 10000ms，react中不使用
* `Idle` 系统清理工作 2^31 - 1 ms 超时时间

## React 与 Scheduler

### 哪些任务会进Scheduler

### 入队时机

### 优先级映射&#x20;

Lane是react reconciler中，对渲染（setState）做的一个优先级标记。

不同来源的更新会映射成不同的Lane、不同的Lane又对应不同的Scheduler优先级，进而对应在taskQueue内部不同超时时间。

大致分如下类、完整映射关系见文末附录。

* SyncLane、用户离散事件 如 `input`、`click`、不进 Scheduler&#x20;
* ContinuousLane、用户连续事件 如 scroll resize、 对应 Userblocking 250ms超时
* TransionLane、用户声明可延迟更新 `useTransition` 和 `useDefferedValue`、对应 Normal 5000ms超时
* DefaultLane、非用户触发的业务逻辑、对应Normal 5000ms超时
* Idel、业务逻辑无关的清理、对应 2^31 -1ms超时

### 分级渲染

不同的Lane在渲染执行的时机上有所区别。

* SyncLane 渲染任务进微任务队列，在微任务阶段直接执行渲染，不进scheduler
* ContinuousLane、DefaultLane
  * 在宏任务阶段，将挂一个“放入scheduler”的微任务。
  * 微任务阶段，进 Scheduler的taskQueue
  * 第二轮宏任务：由Scheculer产生一个新分片，该分片中执行渲染，渲染过程不被中断。
* TransionLane 入队的过程和ContinuousLane相同。在5ms分片时间到后，TransitionLane会中断，此时
  * 被别的高优先级的渲染插队了，WIP Fiber树会被丢弃
  * 没被插队，在基于被中断的 WIP Fiber树继续计算。

## Q & A 常见问题问答

### React 用 Scheduler 解决了什么问题

### 哪些包引用了 Scheduler

### Scheduler的出现版本

## 附录

### Lane、dom api、Scheduler优先级完整映射关系&#x20;

| **lane**                       | **典型入口（DOM API / 非事件）**                                                                                 | **Scheduler 优先级** |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------- |
| `SyncHydrationLane`            | 离散事件期间触发的 hydration                                                                                     | **不进 Scheduler**  |
| `SyncLane`                     | `click`  `mousedown` `keyup` `input` `change` `submit` 等离散用户操作事件                                        | **不进 Scheduler**  |
| `InputContinuousHydrationLane` | 连续事件期间触发的 hydration                                                                                     | **UserBlocking**  |
| `InputContinuousLane`          | `scroll` `wheel` `pointermove ` `resize` 等连续用户操作事件                                                      | **UserBlocking**  |
| `DefaultHydrationLane`         | 默认优先级期间触发的 hydration                                                                                    | **Normal**        |
| `DefaultLane`                  | 非事件上下文：`setTimeout`/`setInterval`/`Promise.then`/`await` 之后、`useEffect`、ref 回调等                         | **Normal**        |
| `GestureLane`                  | `startGestureTransition`（`enableGestureTransition`，实验）                                                  | **Normal**        |
| `TransitionHydrationLane`      | transition 期间触发的 hydration                                                                              | **Normal**        |
| `TransitionLane1`…`10`         | `startTransition` 里的 setState                                                                           | **Normal**        |
| `TransitionLane11`…`14`        | **`useDeferredValue`** 派生的那次重渲染                                                                         | **Normal**        |
| `RetryLane1`…`4`               | Suspense 挂起后 thenable settle / `use()` resolve → `retryTimedOutBoundary`                                | **Normal**        |
| `SelectiveHydrationLane`       | 用户在**尚未水合**的 Suspense/Activity 边界上交互 → `attemptContinuousHydration`                                     | **Normal**        |
| `IdleHydrationLane`            | 已无生产者（掩码保留位）                                                                                            | **Idle**          |
| `IdleLane`                     | 已无生产者；只作为 `IdleEventPriority` 的载体                                                                       | **Idle**          |
| `OffscreenLane`                | prerender（`react-dom/static` 的 `prerender`）、`<Activity mode="hidden">` 预渲染、dehydrated 边界的默认 `retryLane` | **Idle**          |
| `DeferredLane`                 | Suspense 的 deferred **标记位**（`markSpawnedDeferredLane`），不是更新入口                                           | **Idle**          |
