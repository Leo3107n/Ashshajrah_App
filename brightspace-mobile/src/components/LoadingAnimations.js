/**
 * Native versions of the supplied loaders: tree growth, dashboard shimmer,
 * and button leaf spinner, all driven by reusable Animated.Value loops.
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, fonts, fontSize, radius, shadows, space } from "../theme";
import AppText from "./ui/AppText";

function useLoop(duration = 2200) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // One normalized 0→1 timeline lets each loader derive its own scale,
    // opacity, translation, and rotation phases with native-driver support.
    const animation = Animated.loop(
      Animated.timing(progress, {
        duration,
        easing: Easing.inOut(Easing.ease),
        toValue: 1,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [duration, progress]);
  return progress;
}

export function TreeGrowingLoader({ message = "Preparing your learning journey...", compact = false }) {
  const progress = useLoop(2200);
  // Interpolated phases reproduce the reference sequence: seed pulse, trunk
  // growth, staggered leaves, then a soft reset before the loop repeats.
  const seedScale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.18, 0.9] });
  const trunkScale = progress.interpolate({ inputRange: [0, 0.14, 0.38, 0.82, 1], outputRange: [0.01, 0.01, 1, 1, 0.01] });
  const trunkOpacity = progress.interpolate({ inputRange: [0, 0.14, 0.38, 0.82, 1], outputRange: [0, 0, 1, 1, 0] });
  return <View accessibilityLabel={message} accessibilityRole="progressbar" style={[styles.treeWrap, compact && styles.treeWrapCompact]}>
    <View style={[styles.tree, compact && styles.treeCompact]}>
      <Animated.View style={[styles.seed, { transform: [{ scale: seedScale }] }]} />
      <Animated.View style={[styles.trunk, compact && styles.trunkCompact, { opacity: trunkOpacity, transform: [{ scaleY: trunkScale }] }]} />
      <Leaf delay={0.25} gold progress={progress} rotate="-36deg" style={compact ? styles.leafCompactOne : styles.leafOne} />
      <Leaf delay={0.34} progress={progress} rotate="36deg" style={compact ? styles.leafCompactTwo : styles.leafTwo} />
      <Leaf delay={0.43} progress={progress} rotate="-68deg" style={compact ? styles.leafCompactThree : styles.leafThree} />
      <Leaf delay={0.52} gold progress={progress} rotate="66deg" style={compact ? styles.leafCompactFour : styles.leafFour} />
      <Leaf delay={0.6} progress={progress} rotate="-4deg" style={compact ? styles.leafCompactFive : styles.leafFive} />
    </View>
    <AppText style={[styles.message, compact && styles.compactMessage]}>{message}</AppText>
    {!compact ? <AppText style={styles.brandLine}>Learning · Character · Leadership</AppText> : null}
  </View>;
}

function Leaf({ delay, gold, progress, rotate, style }) {
  const opacity = progress.interpolate({ inputRange: [0, delay, Math.min(delay + 0.18, 0.78), 0.82, 1], outputRange: [0, 0, 1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, delay, Math.min(delay + 0.18, 0.78), 0.82, 1], outputRange: [0.01, 0.01, 1, 1, 0.7] });
  return <Animated.View style={[styles.leaf, gold && styles.goldLeaf, style, { opacity, transform: [{ rotate }, { scale }] }]} />;
}

export function DashboardSkeleton({ message = "Loading dashboard data..." }) {
  const progress = useLoop(1350);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] });
  const Shimmer = ({ style }) => <View style={[styles.skeletonBlock, style]}><Animated.View style={[styles.shimmer, { transform: [{ translateX }] }]} /></View>;
  return <View accessibilityLabel={message} accessibilityRole="progressbar" style={styles.pageLoader}>
    <View style={styles.skeleton}>
      <Shimmer style={styles.skeletonHero} />
      <View style={styles.skeletonRow}><Shimmer style={styles.skeletonCard} /><Shimmer style={styles.skeletonCard} /></View>
      <Shimmer style={styles.skeletonLineShort} /><Shimmer style={styles.skeletonLine} /><Shimmer style={styles.skeletonLine} />
    </View>
    <AppText style={styles.message}>{message}</AppText>
  </View>;
}

export function LeafSpinner({ color = colors.white, size = 20 }) {
  const progress = useLoop(800);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const leafSize = Math.max(6, size * 0.34);
  return <Animated.View accessibilityRole="progressbar" style={[styles.spinner, { borderColor: `${color}55`, borderTopColor: color, height: size, width: size, borderRadius: size / 2, transform: [{ rotate }] }]}>
    <View style={[styles.spinnerLeaf, { backgroundColor: color, height: leafSize * 1.4, width: leafSize }]} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  pageLoader:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:space.lg,backgroundColor:colors.background},
  treeWrap:{alignItems:"center",justifyContent:"center"},treeWrapCompact:{paddingVertical:space.lg},
  tree:{position:"relative",width:170,height:170},treeCompact:{width:90,height:100},
  seed:{position:"absolute",left:"50%",bottom:18,width:14,height:14,marginLeft:-7,borderRadius:7,backgroundColor:colors.gold,...shadows.subtle},
  trunk:{position:"absolute",left:"50%",bottom:26,width:8,height:92,marginLeft:-4,borderRadius:8,backgroundColor:colors.emeraldMid},trunkCompact:{bottom:20,height:52,width:6,marginLeft:-3},
  leaf:{position:"absolute",width:34,height:48,borderTopLeftRadius:24,borderBottomRightRadius:24,backgroundColor:colors.emerald},goldLeaf:{backgroundColor:colors.gold},
  leafOne:{left:50,top:52},leafTwo:{left:86,top:44},leafThree:{left:40,top:86},leafFour:{left:98,top:82},leafFive:{left:68,top:22},
  leafCompactOne:{left:24,top:35,width:20,height:28},leafCompactTwo:{left:48,top:30,width:20,height:28},leafCompactThree:{left:18,top:54,width:20,height:28},leafCompactFour:{left:56,top:52,width:20,height:28},leafCompactFive:{left:36,top:17,width:20,height:28},
  message:{marginTop:space.md,color:colors.textSecondary,fontFamily:fonts.bodyBold,fontSize:fontSize.xs,letterSpacing:0.5,textAlign:"center"},compactMessage:{marginTop:space.sm},
  brandLine:{marginTop:space.sm,color:colors.gold,fontFamily:fonts.displayBold,fontSize:fontSize.lg,textAlign:"center"},
  skeleton:{width:"100%",maxWidth:420,padding:space.md,borderWidth:1,borderColor:colors.borderGreen,borderRadius:radius["2xl"],backgroundColor:colors.surface,...shadows.subtle},
  skeletonBlock:{overflow:"hidden",backgroundColor:colors.creamDark,borderRadius:radius.lg},skeletonHero:{height:92},skeletonRow:{flexDirection:"row",gap:space.sm,marginVertical:space.md},skeletonCard:{flex:1,height:62},skeletonLine:{height:13,marginBottom:space.sm},skeletonLineShort:{width:"58%",height:13,marginBottom:space.sm},
  shimmer:{position:"absolute",top:0,bottom:0,width:120,backgroundColor:"rgba(255,255,255,0.72)"},
  spinner:{alignItems:"center",justifyContent:"center",borderWidth:2},spinnerLeaf:{borderTopLeftRadius:8,borderBottomRightRadius:8,transform:[{rotate:"-28deg"}]},
});
